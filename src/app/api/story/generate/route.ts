import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ColumnType = "number" | "date" | "string";
type ParsedColumn = { name: string; type: ColumnType; nonNullCount: number; uniqueCount: number; };
type StoryChartType = "bar" | "line" | "pie" | "correlation_heatmap" | "area" | "scatter";

interface AnalysisResult {
  title: string;
  keyInsights: string[];
  keyInsightsChartType: StoryChartType;
  trendAnalysis: { text: string; chartType: StoryChartType };
  notablePatterns: { text: string; chartType: StoryChartType };
  recommendations: string[];
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/[$,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isIdColumn(name: string) {
  const n = name.toLowerCase();
  return n === "id" || n.endsWith("_id") || n.endsWith(" id") || n === "uuid" || n === "key" || n === "index" || n === "employee_id";
}

function selectBestNumericColumnInternal(columns: ParsedColumn[], sample: Record<string, unknown>[]) {
  const numCols = columns.filter(c => c.type === "number");
  if (!numCols.length) return null;
  const scored = numCols.map(c => {
    let score = c.nonNullCount * 1000;
    if (isIdColumn(c.name)) score -= 10000000;
    let sum = 0;
    for (let i = 0; i < Math.min(50, sample.length); i++) {
      const val = parseNumber(sample[i][c.name]);
      if (val !== null) sum += Math.abs(val);
    }
    score += sum;
    return { name: c.name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].name;
}

function selectBestCategoryColumnInternal(columns: ParsedColumn[]) {
  const catCols = columns.filter(c => c.type === "string");
  if (!catCols.length) return null;
  const scored = catCols.map(c => {
    let score = c.nonNullCount;
    if (isIdColumn(c.name)) score -= 1000000;
    const uniquenessRatio = c.uniqueCount / Math.max(1, c.nonNullCount);
    if (uniquenessRatio < 0.9) score += 5000;
    return { name: c.name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].name;
}

function executeHonestAnalysis(
  columns: ParsedColumn[],
  sample: Record<string, unknown>[],
  correlations: { numericColumns: string[]; matrix: number[][] } | null,
  rowCount: number
): AnalysisResult {
  const targetNum = selectBestNumericColumnInternal(columns, sample);
  const targetCat = selectBestCategoryColumnInternal(columns);
  
  const numericCols = columns.filter(c => c.type === "number").map(c => c.name);
  const sampleSuffix = rowCount < 30 ? ` (based on a small sample of ${rowCount} records)` : "";

  const keyInsights: string[] = [];

  // Correlation Analysis
  let bestR = 0;
  let bestPair = ["", ""];
  if (correlations) {
    const { numericColumns, matrix } = correlations;
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const r = matrix[i][j];
        if (Math.abs(r) > Math.abs(bestR)) {
          bestR = r;
          bestPair = [numericColumns[i], numericColumns[j]];
        }
      }
    }
  }

  if (Math.abs(bestR) > 0.4) {
    const dir = bestR > 0 ? "positively correlated" : "negatively correlated";
    keyInsights.push(`${bestPair[0]} and ${bestPair[1]} show a correlation (r ≈ ${bestR.toFixed(2)})${sampleSuffix}.`);
  }

  // Category Distribution
  if (targetCat && targetNum) {
    const groups = new Map<string, number[]>();
    sample.forEach(row => {
      const k = String(row[targetCat] || "Unknown");
      const v = parseNumber(row[targetNum]);
      if (v !== null) {
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(v);
      }
    });

    const means = [...groups.entries()].map(([k, vs]) => ({ k, avg: vs.reduce((a, b) => a + b, 0) / vs.length }))
      .sort((a, b) => b.avg - a.avg);

    if (means.length >= 2) {
      keyInsights.push(`${targetCat} subgroups show varying averages for ${targetNum}; ${means[0].k} shows the highest observed average, while ${means[means.length-1].k} is lower.`);
    }
  }

  if (keyInsights.length < 1) {
    keyInsights.push("Initial data scan complete. No high-variance outliers or extreme correlations were detected in this sample.");
  }

  const trend = (() => {
    const dateCol = columns.find(c => c.type === "date")?.name;
    if (dateCol && targetNum) {
      return {
        chartType: "line" as const,
        text: `This chart shows how ${targetNum} changes over ${dateCol}.`
      };
    }
    if (targetCat && targetNum) {
      return {
        chartType: "bar" as const,
        text: `This shows the average ${targetNum} for each ${targetCat}.`
      };
    }
    return {
      chartType: "pie" as const,
      text: `This shows how records are distributed across categories.`
    };
  })();

  const pattern = (() => {
    if (Math.abs(bestR) > 0.5) {
      return {
        chartType: "scatter" as const,
        text: `The distribution between ${bestPair[0]} and ${bestPair[1]}.`
      };
    } else if (numericCols.length >= 3) {
      return {
        chartType: "correlation_heatmap" as const,
        text: `A correlation matrix identifying associations between numeric factors.`
      };
    }
    return {
      chartType: "bar" as const,
      text: `Observed differences in ${targetNum || 'metrics'} by ${targetCat || 'category'} are presented here for segment comparison.`
    };
  })();

  const recommendations = [
    Math.abs(bestR) > 0.5 ? `Analyze the relationship between ${bestPair[0]} and ${bestPair[1]} further to determine if the association is stable across groups.` : "Gather more data to verify if current associations remain consistent.",
    targetCat ? `Compare ${targetNum} vs other metrics within each ${targetCat} to identify potential inconsistencies.` : "Analyze variance across different segments to identify unique patterns.",
    "Avoid interpreting statistical correlations as causal relationships without experimental validation.",
    "Use bar charts for subgroup comparisons rather than assuming continuous time-based trends."
  ];

  return {
    title: targetNum ? `Analysis: ${targetNum}` : "Data Report",
    keyInsights: keyInsights.slice(0, 3),
    keyInsightsChartType: pattern.chartType === "correlation_heatmap" ? "bar" : (pattern.chartType as StoryChartType),
    trendAnalysis: trend,
    notablePatterns: pattern,
    recommendations: recommendations.slice(0, 4)
  };
}

export async function POST(req: Request) {
  try {
    const { columns, sample, correlations, rowCount } = await req.json();
    if (!columns?.length) return NextResponse.json({ error: "Missing data" }, { status: 400 });
    
    const story = executeHonestAnalysis(columns, sample, correlations, rowCount || sample.length);
    return NextResponse.json({ story }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
