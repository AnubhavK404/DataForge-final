import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type ColumnType = "number" | "date" | "string";

type ParsedColumn = {
  name: string;
  type: ColumnType;
  nonNullCount: number;
  uniqueCount: number;
};

type StoryChartType = "bar" | "line" | "pie" | "correlation_heatmap";

type StoryResponse = {
  title: string;
  keyInsights: string[];
  keyInsightsChartType: StoryChartType;
  trendAnalysis: { text: string; chartType: StoryChartType };
  notablePatterns: { text: string; chartType: StoryChartType };
  recommendations: string[];
};

function toCleanString(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseNumber(v: unknown): number | null {
  const s = toCleanString(v);
  if (!s) return null;
  const cleaned = s.replace(/[$,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDateToTs(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = toCleanString(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function formatDateKey(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mean(arr: number[]) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function heuristicStory(input: {
  columns: ParsedColumn[];
  sample: Record<string, unknown>[];
  correlations:
    | null
    | {
        numericColumns: string[];
        matrix: number[][];
      };
}): StoryResponse {
  const { columns, sample, correlations } = input;

  const numericCols = columns.filter((c) => c.type === "number").map((c) => c.name);
  const dateCols = columns.filter((c) => c.type === "date").map((c) => c.name);
  const catCols = columns.filter((c) => c.type === "string").map((c) => c.name);

  const firstNumeric = numericCols[0] ?? null;
  const firstDate = dateCols[0] ?? null;
  const firstCat = catCols[0] ?? null;

  const keyInsights: string[] = [];

  // Correlation insight
  let bestCorr: { a: string; b: string; r: number } | null = null;
  if (correlations && correlations.numericColumns.length >= 2) {
    const { numericColumns, matrix } = correlations;
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const r = matrix[i]?.[j] ?? 0;
        if (!bestCorr || Math.abs(r) > Math.abs(bestCorr.r)) {
          bestCorr = { a: numericColumns[i], b: numericColumns[j], r };
        }
      }
    }
    if (bestCorr) {
      const dir = bestCorr.r >= 0 ? "positive" : "negative";
      keyInsights.push(
        `Strong ${dir} relationship between ${bestCorr.a} and ${bestCorr.b} (r ≈ ${bestCorr.r.toFixed(
          2
        )}).`
      );
    }
  }

  // Weekend vs weekday (first date + numeric)
  if (firstDate && firstNumeric) {
    const bucket: Record<"weekday" | "weekend", number[]> = { weekday: [], weekend: [] };
    for (const row of sample) {
      const ts = parseDateToTs(row[firstDate]);
      const val = parseNumber(row[firstNumeric]);
      if (ts === null || val === null) continue;
      const day = new Date(ts).getDay(); // 0 Sun .. 6 Sat
      const key = day === 0 || day === 6 ? "weekend" : "weekday";
      bucket[key].push(val);
    }
    const wd = mean(bucket.weekday);
    const we = mean(bucket.weekend);
    if (wd !== null && we !== null && Math.abs(wd) > 1e-9) {
      const lift = (we - wd) / wd;
      const dir = lift >= 0 ? "higher" : "lower";
      keyInsights.push(
        `On weekends, ${firstNumeric} is typically ${dir} than weekdays by about ${Math.abs(lift * 100).toFixed(
          0
        )}%.`
      );
    }
  }

  // Category concentration (first cat)
  if (firstCat) {
    const counts = new Map<string, number>();
    const numericValues = firstNumeric ? new Map<string, number[]>() : null;

    for (const row of sample) {
      const key = toCleanString(row[firstCat]);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (numericValues) {
        const val = parseNumber(row[firstNumeric!]);
        if (val !== null) {
          const arr = numericValues.get(key) ?? [];
          arr.push(val);
          numericValues.set(key, arr);
        }
      }
    }

    const topCats = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    if (topCats.length) {
      const tail = numericValues ? `; biggest group is ${topCats[0]}.` : `Top group is ${topCats[0]}.`;
      if (numericValues && topCats[1]) {
        keyInsights.push(
          `The data is concentrated in a few ${firstCat} categories: ${topCats.join(
            ", "
          )}. ${tail}`
        );
      } else {
        keyInsights.push(`The data is concentrated in a few ${firstCat} categories: ${topCats.join(", ")}.${tail}`);
      }
    }
  }

  // Ensure 3-5 insights
  const fallback = "Upload a different dataset to unlock more specific story insights.";
  while (keyInsights.length < 3) keyInsights.push(fallback);
  if (keyInsights.length > 5) keyInsights.splice(5);

  // Trend analysis chart + text
  let trendChartType: StoryChartType = "bar";
  if (firstDate && firstNumeric) trendChartType = "line";
  else if (firstNumeric && firstCat) trendChartType = "bar";
  else if (!firstNumeric && firstCat) trendChartType = "pie";
  else if (firstNumeric) trendChartType = "bar";

  let trendText = "We can look for patterns over time or across groups.";
  if (trendChartType === "line" && firstDate && firstNumeric) {
    // bucket by day
    const buckets = new Map<string, { ts: number; sum: number; n: number }>();
    for (const row of sample) {
      const ts = parseDateToTs(row[firstDate]);
      const val = parseNumber(row[firstNumeric]);
      if (ts === null || val === null) continue;
      const key = formatDateKey(ts);
      const cur = buckets.get(key) ?? { ts, sum: 0, n: 0 };
      cur.sum += val;
      cur.n += 1;
      buckets.set(key, cur);
    }
    const ordered = [...buckets.entries()]
      .map(([k, v]) => ({ key: k, ts: v.ts, avg: v.n ? v.sum / v.n : 0 }))
      .sort((a, b) => a.ts - b.ts);

    if (ordered.length >= 4) {
      const first = ordered.slice(0, Math.max(2, Math.floor(ordered.length * 0.2)));
      const last = ordered.slice(Math.max(0, ordered.length - first.length));
      const firstAvg = mean(first.map((d) => d.avg));
      const lastAvg = mean(last.map((d) => d.avg));
      if (firstAvg !== null && lastAvg !== null && Math.abs(firstAvg) > 1e-9) {
        const lift = (lastAvg - firstAvg) / firstAvg;
        const dir = lift >= 0 ? "rises" : "falls";
        trendText = `Over time, ${firstNumeric} ${dir} (from early average to late average, about ${Math.abs(
          lift * 100
        ).toFixed(0)}% change).`;
      } else {
        trendText = `There are noticeable movements in ${firstNumeric} over time; try a line chart to explore the shape.`;
      }
    } else {
      trendText = `There are date values, but not enough points in the sample to summarize the trend confidently.`;
    }
  } else if (trendChartType === "bar" && firstCat && firstNumeric) {
    // Compare top vs bottom categories by average numeric value
    const groups = new Map<string, number[]>();
    for (const row of sample) {
      const key = toCleanString(row[firstCat]);
      if (!key) continue;
      const val = parseNumber(row[firstNumeric]);
      if (val === null) continue;
      const arr = groups.get(key) ?? [];
      arr.push(val);
      groups.set(key, arr);
    }
    const ranked = [...groups.entries()]
      .map(([k, arr]) => ({ k, avg: mean(arr) ?? 0 }))
      .sort((a, b) => b.avg - a.avg);
    if (ranked.length >= 2) {
      trendText = `When you group by ${firstCat}, the highest ${firstCat} group has a noticeably different ${firstNumeric} average than the lowest group.`;
    } else {
      trendText = `Grouping by ${firstCat} may reveal differences in ${firstNumeric}; a bar chart is a good starting point.`;
    }
  } else if (trendChartType === "pie") {
    trendText = `The distribution of categories suggests a few groups dominate; a pie chart highlights the share quickly.`;
  }

  // Notable patterns + chart
  let notableChartType: StoryChartType = "pie";
  if (correlations?.numericColumns?.length) notableChartType = "correlation_heatmap";
  else if (firstCat && firstNumeric) notableChartType = "bar";
  else if (firstCat) notableChartType = "pie";

  const notableText =
    correlations && bestCorr
      ? `The strongest pattern is the ${bestCorr.r >= 0 ? "positive" : "negative"} relationship between ${bestCorr.a} and ${bestCorr.b}.`
      : `The biggest patterns are likely driven by how categories are distributed across the dataset.`;

  const recs: string[] = [];
  if (trendChartType === "line" && firstDate && firstNumeric) {
    recs.push(`Use the line chart to track ${firstNumeric} over ${firstDate}.`);
  } else if (trendChartType === "bar" && firstCat && firstNumeric) {
    recs.push(`Try a bar chart of ${firstNumeric} by ${firstCat} to compare groups.`);
  } else if (trendChartType === "pie" && firstCat) {
    recs.push(`Use a pie chart to quickly see which ${firstCat} categories dominate.`);
  }
  if (notableChartType === "correlation_heatmap") {
    recs.push("Add a correlation heatmap to spot relationships worth investigating.");
  }
  if (firstCat && firstNumeric) {
    recs.push(`Filter to the top ${firstCat} categories, then re-check trends for ${firstNumeric}.`);
  }
  recs.push("If results look surprising, try switching the chart type and regenerate the story.");

  return {
    title: firstCat && firstNumeric ? `Story: ${firstCat} × ${firstNumeric}` : "Story: Your dataset",
    keyInsights,
    keyInsightsChartType: notableChartType === "correlation_heatmap" ? "bar" : notableChartType,
    trendAnalysis: { text: trendText, chartType: trendChartType },
    notablePatterns: { text: notableText, chartType: notableChartType },
    recommendations: recs.slice(0, 5),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const columns = body?.columns as ParsedColumn[] | undefined;
    const sample = (body?.sample as Record<string, unknown>[] | undefined) ?? [];
    const correlations = body?.correlations as
      | { numericColumns: string[]; matrix: number[][] }
      | null
      | undefined;

    if (!columns?.length) {
      return NextResponse.json({ error: "Missing columns for story generation." }, { status: 400 });
    }

    const heuristic = heuristicStory({
      columns,
      sample,
      correlations: correlations ?? null,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ story: heuristic }, { status: 200 });

    const openai = new OpenAI({ apiKey });

    const prompt = {
      columns: columns.map((c) => ({ name: c.name, type: c.type })),
      sample: sample.slice(0, 80),
      correlations,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a data storytelling assistant for beginners. Produce a JSON story for the UI. Keep sentences short and actionable.",
        },
        {
          role: "user",
          content:
            "Return ONLY valid JSON with keys: title, keyInsights (array 3-5), keyInsightsChartType, trendAnalysis {text, chartType}, notablePatterns {text, chartType}, recommendations (array 3-5). chartType must be one of: bar, line, pie, correlation_heatmap.",
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const story = parsed as StoryResponse;

    return NextResponse.json({ story: story ?? heuristic }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to generate story." }, { status: 500 });
  }
}

