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

function topK(arr: { k: string; v: number }[], k: number) {
  return [...arr].sort((a, b) => b.v - a.v).slice(0, k);
}

function safeNumber(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[$,]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatPct(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${(abs * 100).toFixed(abs >= 0.1 ? 0 : 1)}%`;
}

function heuristicInsights(input: {
  columns: ParsedColumn[];
  sample: Record<string, unknown>[];
  correlations:
    | null
    | {
        numericColumns: string[];
        matrix: number[][];
      };
}) {
  const { columns, sample, correlations } = input;
  const numericCols = columns.filter((c) => c.type === "number").map((c) => c.name);
  const dateCols = columns.filter((c) => c.type === "date").map((c) => c.name);
  const catCols = columns.filter((c) => c.type === "string").map((c) => c.name);

  const suggestions: string[] = [];
  if (numericCols.length && dateCols.length) suggestions.push("line");
  if (numericCols.length && catCols.length) suggestions.push("bar");
  if (catCols.length) suggestions.push("pie");
  if (numericCols.length >= 2) suggestions.push("correlation_heatmap");

  const insights: string[] = [];

  // Correlations
  if (correlations && correlations.numericColumns.length >= 2) {
    const { numericColumns, matrix } = correlations;
    const pairs: { a: string; b: string; r: number }[] = [];
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const r = matrix[i][j] ?? 0;
        pairs.push({ a: numericColumns[i], b: numericColumns[j], r });
      }
    }
    pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
    const top = pairs[0];
    if (top && Math.abs(top.r) > 0.4) {
      const dir = top.r >= 0 ? "positive" : "negative";
      insights.push(
        `There’s a strong ${dir} correlation between ${top.a} and ${top.b} (r ≈ ${top.r.toFixed(
          2
        )}).`
      );
    }
  }

  // Category concentration
  if (catCols.length) {
    const col = catCols[0];
    const counts = new Map<string, number>();
    for (const row of sample) {
      const v = row[col];
      const key = v === null || v === undefined ? "" : String(v).trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    const topCats = sorted.slice(0, 3);
    
    if (topCats.length) {
      const desc = topCats
        .map((c) => `${c.k} (${c.v})`)
        .join(", ");
      insights.push(`Top categories in ${col}: ${desc}.`);
    }
  }

  // Weekend / weekday pattern
  if (dateCols.length && numericCols.length) {
    const dateCol = dateCols[0];
    const valueCol = numericCols[0];
    const buckets: Record<"weekday" | "weekend", { sum: number; n: number }> = {
      weekday: { sum: 0, n: 0 },
      weekend: { sum: 0, n: 0 },
    };

    for (const row of sample) {
      const d = row[dateCol];
      const t = typeof d === "number" ? d : Date.parse(String(d));
      const val = safeNumber(row[valueCol]);
      if (!Number.isFinite(t) || t === null || val === null) continue;
      const day = new Date(t).getDay(); // 0=Sun
      const bucket = day === 0 || day === 6 ? "weekend" : "weekday";
      buckets[bucket].sum += val;
      buckets[bucket].n += 1;
    }

    const wd = buckets.weekday.n ? buckets.weekday.sum / buckets.weekday.n : null;
    const we = buckets.weekend.n ? buckets.weekend.sum / buckets.weekend.n : null;
    if (wd !== null && we !== null && wd !== 0) {
      const lift = (we - wd) / wd;
      const dir = lift >= 0 ? "higher" : "lower";
      insights.push(
        `On weekends, ${valueCol} is ${dir} by about ${formatPct(
          lift
        )} compared to weekdays (based on sample rows).`
      );
    }
  }

  if (!insights.length) insights.push("Initial data scan complete. No high-variance outliers detected in this sample.");

  return { suggestions, insights };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const columns = body?.columns as ParsedColumn[] | undefined;
    const sample = (body?.sample as Record<string, unknown>[] | undefined) ?? [];
    const correlations = body?.correlations ?? null;
    if (!columns?.length) {
      return NextResponse.json({ error: "Missing columns for insights." }, { status: 400 });
    }

    // Always have a fast heuristic fallback.
    const heuristic = heuristicInsights({ columns, sample, correlations });

    const openAiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    
    const apiKey = openAiKey || groqKey;
    if (!apiKey) {
      return NextResponse.json(heuristic);
    }

    const client = new OpenAI({ 
      apiKey,
      baseURL: openAiKey ? undefined : "https://api.groq.com/openai/v1"
    });

    const model = openAiKey ? "gpt-4o-mini" : "qwen-2.5-32b";

    const prompt = {
      columns,
      chartHints: heuristic.suggestions,
      heuristics: heuristic.insights,
      sample: sample.slice(0, 80),
    };

    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "You are a data assistant for beginners. Return concise insights and recommended chart types. Do not hallucinate variables that are not in the provided columns.",
          },
          {
            role: "user",
            content:
              "Analyze the dataset (prompt is JSON). Output ONLY valid JSON with keys: suggestions (array of strings from {bar,line,pie,area,scatter,correlation_heatmap}) and insights (array of short, fact-based sentences).",
          },
          { role: "user", content: JSON.stringify(prompt) },
        ],
        response_format: { type: "json_object" },
      });

      const raw = completion.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : heuristic.suggestions;
      const insights = Array.isArray(parsed.insights) ? parsed.insights : heuristic.insights;
      return NextResponse.json({ suggestions, insights });
    } catch (err) {
      console.error("AI Insights Error:", err);
      return NextResponse.json(heuristic);
    }
  } catch (err) {
    console.error("POST Insights Error:", err);
    return NextResponse.json({ error: "Failed to generate insights." }, { status: 500 });
  }
}
