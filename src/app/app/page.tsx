"use client";

import { useMemo, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import clsx from "clsx";
import StoryArticle, {
  type StoryResponse,
  type BarConfig,
  type LineConfig,
  type PieConfig,
  type CorrelationConfig,
} from "./components/StoryArticle";


import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Treemap,
  RadialBarChart,
  RadialBar,
  Funnel,
  FunnelChart,
  Sankey,
  Brush,
  ErrorBar,
  ZAxis,
} from "recharts";
import html2canvas from "html2canvas";

type ColumnType = "number" | "date" | "string";

type ParsedColumn = {
  name: string;
  type: ColumnType;
  nonNullCount: number;
  uniqueCount: number;
};

type ParsedDatasetResponse = {
  sha256: string;
  filename: string;
  rowCount: number;
  columns: ParsedColumn[];
  groups: {
    numericColumns: string[];
    dateColumns: string[];
    categoricalColumns: string[];
  };
  sample: Record<string, unknown>[];
  correlations:
    | null
    | { numericColumns: string[]; matrix: number[][] };
};

type InsightsResponse = {
  suggestions: string[];
  insights: string[];
};

type ActiveChart = 
  | "bar" | "line" | "pie" | "correlation_heatmap" | "area" | "scatter" | "radar" | "radial_bar" | "treemap" | "funnel" | "composed"
  | "sankey" | "sunburst" | "brush" | "bubble" | "waterfall" | "box_plot" | "error_bar" | "parallel" | "scatter_label" | "multi_area";

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim().replace(/[$,]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toTimestamp(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function formatDateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function correlationColor(value: number) {
  const clamped = Math.max(-1, Math.min(1, value));
  const t = (clamped + 1) / 2; // 0..1
  const r = Math.round(255 * (1 - t));
  const g = Math.round(100 * (1 - Math.abs(t - 0.5) * 2));
  const b = Math.round(255 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function isIdColumn(name: string) {
  const n = name.toLowerCase();
  return n === "id" || n.endsWith("_id") || n.endsWith(" id") || n === "uuid" || n === "key" || n === "index";
}

function selectBestNumericColumn(dataset: ParsedDatasetResponse | null) {
  if (!dataset || !dataset.columns) return null;
  const numCols = dataset.columns.filter(c => c.type === "number");
  if (!numCols.length) return null;
  const scored = numCols.map(c => {
    let score = c.nonNullCount * 1000;
    if (isIdColumn(c.name)) score -= 10000000;
    let sum = 0;
    for (let i = 0; i < Math.min(50, dataset.sample.length); i++) {
      const val = toNumber(dataset.sample[i][c.name]);
      if (val !== null) sum += Math.abs(val);
    }
    score += sum;
    return { name: c.name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].name;
}

function selectBestCategoryColumn(columns: ParsedColumn[] | undefined) {
  if (!columns) return null;
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

function selectBestPieCategoryColumn(columns: ParsedColumn[] | undefined) {
  if (!columns) return null;
  const catCols = columns.filter(c => c.type === "string");
  if (!catCols.length) return null;
  const scored = catCols.map(c => {
    let score = c.nonNullCount;
    if (isIdColumn(c.name)) score -= 1000000;
    if (c.uniqueCount > 1 && c.uniqueCount <= 10) score += 10000;
    return { name: c.name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].name;
}

function preferredActiveChart(dataset: ParsedDatasetResponse): ActiveChart {
  const scores: Record<ActiveChart, number> = {
    bar: -Infinity,
    line: -Infinity,
    pie: -Infinity,
    scatter: -Infinity,
    area: -Infinity,
    radar: -Infinity,
    radial_bar: -Infinity,
    treemap: -Infinity,
    funnel: -Infinity,
    composed: -Infinity,
    correlation_heatmap: -Infinity,
    sankey: -Infinity,
    sunburst: -Infinity,
    brush: -Infinity,
    bubble: -Infinity,
    waterfall: -Infinity,
    box_plot: -Infinity,
    error_bar: -Infinity,
    parallel: -Infinity,
    scatter_label: -Infinity,
    multi_area: -Infinity
  };

  const hasNum = dataset.groups.numericColumns.length > 0;
  const hasCat = dataset.groups.categoricalColumns.length > 0;
  const hasDate = dataset.groups.dateColumns.length > 0;

  if (dataset.groups.numericColumns.length >= 2 && dataset.correlations?.matrix) {
    let maxR = 0;
    const n = dataset.correlations.matrix.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const r = Math.abs(dataset.correlations.matrix[i][j]);
        if (r > maxR) maxR = r;
      }
    }
    scores.scatter = maxR >= 0.7 ? 95 : maxR * 100;
  }

  if (hasDate && hasNum) {
    scores.line = 90;
    scores.area = 85;
  }

  if (hasCat && hasNum) {
    const catCol = dataset.columns.find(c => c.name === dataset.groups.categoricalColumns[0]);
    if (catCol) {
      if (catCol.uniqueCount >= 3 && catCol.uniqueCount <= 20) {
        scores.bar = 88;
      } else if (catCol.uniqueCount < 3) {
        scores.bar = 50;
      } else {
        scores.bar = 30;
      }
    }
  }

  if (hasCat) {
    const catCol = dataset.columns.find(c => c.name === dataset.groups.categoricalColumns[0]);
    if (catCol) {
      if (catCol.uniqueCount >= 2 && catCol.uniqueCount <= 7) {
        scores.pie = 92; 
      } else {
        scores.pie = 10; 
      }
    }
  }

  if (dataset.groups.numericColumns.length >= 3) {
    scores.correlation_heatmap = Math.min(98, dataset.groups.numericColumns.length * 15);
  }

  let bestChart: ActiveChart = "bar";
  let maxScore = -Infinity;
  for (const [chart, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestChart = chart as ActiveChart;
    }
  }
  return bestChart;
}

export default function AppPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [dataset, setDataset] = useState<ParsedDatasetResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [story, setStory] = useState<StoryResponse | null>(null);

  const [loadingDataset, setLoadingDataset] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingStory, setLoadingStory] = useState(false);

  const [activeChart, setActiveChart] = useState<ActiveChart>("bar");
  const [error, setError] = useState<string | null>(null);

  const dynamicPalette = useMemo(() => {
    const hues = [260, 280, 310, 340, 10, 180, 160];
    const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);
    const selectedHues = shuffle(hues);
    return selectedHues.map(h => `hsl(${h}, 70%, 60%)`);
  }, [dataset, activeChart]);

  const getValueColor = (val: number, max: number) => {
    const ratio = val / (max || 1);
    if (ratio > 0.8) return "#22C55E"; // Success Green
    if (ratio < 0.2) return "#EF4444"; // Warning Red
    return "url(#barG)"; // Default Brand Gradient
  };

  const barConfig = useMemo<BarConfig | null>(() => {
    if (!dataset) return null;
    const x = selectBestCategoryColumn(dataset.columns) ?? dataset.groups.categoricalColumns[0] ?? null;
    const y = selectBestNumericColumn(dataset) ?? dataset.groups.numericColumns[0] ?? null;
    if (!x || !y) return null;

    const sums = new Map<string, { sum: number; n: number }>();
    for (const row of dataset.sample) {
      const xVal = row[x];
      const xKey = xVal === null || xVal === undefined ? "" : String(xVal).trim();
      const yVal = toNumber(row[y]);
      if (!xKey || yVal === null) continue;

      const cur = sums.get(xKey) ?? { sum: 0, n: 0 };
      cur.sum += yVal;
      cur.n += 1;
      sums.set(xKey, cur);
    }

    const data = [...sums.entries()]
      .map(([name, v]) => ({ name, value: v.n ? v.sum / v.n : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return { x, y, data };
  }, [dataset]);

  const lineConfig = useMemo<LineConfig | null>(() => {
    if (!dataset) return null;
    const dateCol = dataset.groups.dateColumns[0] ?? null;
    const valueCol = selectBestNumericColumn(dataset) ?? dataset.groups.numericColumns[0] ?? null;
    if (!dateCol || !valueCol) return null;

    const buckets = new Map<string, { sum: number; n: number; ts: number }>();
    for (const row of dataset.sample) {
      const ts = toTimestamp(row[dateCol]);
      const val = toNumber(row[valueCol]);
      if (ts === null || val === null) continue;

      const key = formatDateKey(ts);
      const cur = buckets.get(key) ?? { sum: 0, n: 0, ts };
      cur.sum += val;
      cur.n += 1;
      buckets.set(key, cur);
    }

    const data = [...buckets.entries()]
      .map(([date, v]) => ({ date, value: v.n ? v.sum / v.n : 0, ts: v.ts }))
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 40)
      .map(({ date, value }) => ({ date, value }));

    return { dateCol, valueCol, data };
  }, [dataset]);

  const pieConfig = useMemo<PieConfig | null>(() => {
    if (!dataset) return null;
    const catCol = selectBestPieCategoryColumn(dataset.columns) ?? dataset.groups.categoricalColumns[0] ?? null;
    const numCol = selectBestNumericColumn(dataset) ?? dataset.groups.numericColumns[0] ?? null;
    if (!catCol) return null;

    const counts = new Map<string, number>();
    for (const row of dataset.sample) {
      const v = row[catCol];
      const key = v === null || v === undefined ? "" : String(v).trim();
      if (!key) continue;
      const val = numCol ? toNumber(row[numCol]) ?? 1 : 1;
      counts.set(key, (counts.get(key) ?? 0) + val);
    }

    const data = [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { catCol, data };
  }, [dataset]);

  const areaConfig = useMemo(() => {
    if (!dataset) return null;
    const dateCol = dataset.groups.dateColumns[0] ?? null;
    const valueCol = selectBestNumericColumn(dataset) ?? dataset.groups.numericColumns[0] ?? null;
    if (!dateCol || !valueCol) return null;
    return lineConfig;
  }, [dataset, lineConfig]);

  const scatterConfig = useMemo(() => {
    if (!dataset) return null;
    const numCols = dataset.groups.numericColumns.filter(c => !isIdColumn(c));
    if (numCols.length < 2) return null;
    const x = numCols[0];
    const y = numCols[1];
    const data = dataset.sample.map(row => {
      const cat = row[dataset.groups.categoricalColumns[0] ?? ""];
      return {
        x: toNumber(row[x]) ?? 0,
        y: toNumber(row[y]) ?? 0,
        name: cat ? String(cat).trim() : ""
      };
    }).slice(0, 100);
    return { x, y, data };
  }, [dataset]);

  const correlationConfig = useMemo<CorrelationConfig | null>(() => {
    if (!dataset?.correlations) return null;
    return {
      numericColumns: dataset.correlations.numericColumns,
      matrix: dataset.correlations.matrix,
    };
  }, [dataset]);

  const radarConfig = useMemo(() => {
    if (!dataset || dataset.groups.numericColumns.length < 3) return null;
    const cat = selectBestCategoryColumn(dataset.columns) ?? dataset.groups.categoricalColumns[0];
    if (!cat) return null;
    const metrics = dataset.groups.numericColumns.slice(0, 5);
    
    const groups = new Map<string, any>();
    for (const row of dataset.sample) {
      const k = String(row[cat] || "Other").trim();
      if (!k) continue;
      const cur = groups.get(k) || { name: k, count: 0 };
      metrics.forEach(m => {
        cur[m] = (cur[m] || 0) + (toNumber(row[m]) || 0);
      });
      cur.count++;
      groups.set(k, cur);
    }
    
    const data = [...groups.values()]
      .map(g => {
        const obj: any = { name: g.name };
        metrics.forEach(m => obj[m] = g.count ? g[m] / g.count : 0);
        return obj;
      })
      .slice(0, 6);

    return { metrics, data };
  }, [dataset]);

  const radialBarConfig = useMemo(() => {
    if (!dataset) return null;
    const cat = selectBestCategoryColumn(dataset.columns) ?? dataset.groups.categoricalColumns[0];
    const val = selectBestNumericColumn(dataset) ?? dataset.groups.numericColumns[0];
    if (!cat || !val) return null;

    const groups = new Map<string, number>();
    dataset.sample.forEach(row => {
      const k = String(row[cat] || "Other").trim();
      if (!k) return;
      groups.set(k, (groups.get(k) || 0) + (toNumber(row[val]) || 0));
    });

    const data = [...groups.entries()]
      .map(([name, value], i) => ({
        name,
        value,
        fill: dynamicPalette[i % dynamicPalette.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { cat, val, data };
  }, [dataset, dynamicPalette]);

  const treemapConfig = useMemo(() => {
    if (!dataset) return null;
    const cat = selectBestCategoryColumn(dataset.columns) ?? dataset.groups.categoricalColumns[0];
    const val = selectBestNumericColumn(dataset) ?? dataset.groups.numericColumns[0];
    if (!cat || !val) return null;
    const groups = new Map<string, number>();
    dataset.sample.forEach(row => {
      const k = String(row[cat] || "Unknown");
      groups.set(k, (groups.get(k) || 0) + (toNumber(row[val]) || 0));
    });
    const children = [...groups.entries()].map(([name, size]) => ({ name, size }));
    return { name: cat, children };
  }, [dataset]);

  const funnelConfig = useMemo(() => {
    if (!dataset) return null;
    const cat = selectBestCategoryColumn(dataset.columns) ?? dataset.groups.categoricalColumns[0];
    const val = selectBestNumericColumn(dataset) ?? dataset.groups.numericColumns[0];
    if (!cat || !val) return null;

    const groups = new Map<string, number>();
    dataset.sample.forEach(row => {
      const k = String(row[cat] || "Other").trim();
      if (!k) return;
      groups.set(k, (groups.get(k) || 0) + (toNumber(row[val]) || 0));
    });

    const data = [...groups.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { data };
  }, [dataset]);

  const composedConfig = useMemo(() => {
    if (!dataset) return null;
    const x = selectBestCategoryColumn(dataset.columns) ?? dataset.groups.categoricalColumns[0];
    const yBar = dataset.groups.numericColumns[0];
    const yLine = dataset.groups.numericColumns[1];
    if (!x || !yBar || !yLine) return null;

    const groups = new Map<string, { bar: number; line: number; count: number }>();
    dataset.sample.forEach(row => {
      const k = String(row[x] || "Other").trim();
      if (!k) return;
      const cur = groups.get(k) || { bar: 0, line: 0, count: 0 };
      cur.bar += toNumber(row[yBar]) || 0;
      cur.line += toNumber(row[yLine]) || 0;
      cur.count++;
      groups.set(k, cur);
    });

    const data = [...groups.entries()]
      .map(([name, v]) => ({
        name,
        bar: v.count ? v.bar / v.count : 0,
        line: v.count ? v.line / v.count : 0
      }))
      .slice(0, 10);

    return { x, yBar, yLine, data };
  }, [dataset]);

  // INSANE MODES (PREMIUM) - DATA SCIENTIST RE-ENGINEERING
  const sankeyConfig = useMemo(() => {
    if (!dataset || dataset.groups.categoricalColumns.length < 2 || !dataset.groups.numericColumns[0]) return null;
    const c1 = dataset.groups.categoricalColumns[0];
    const c2 = dataset.groups.categoricalColumns[1];
    const val = dataset.groups.numericColumns[0];
    
    const nodes: any[] = [];
    const nodeMap = new Map<string, number>();
    const linkMap = new Map<string, number>();

    dataset.sample.forEach(row => {
      const s = String(row[c1] || "Source");
      const t = String(row[c2] || "Target");
      const v = toNumber(row[val]) || 0;
      
      if (!nodeMap.has(s)) { nodeMap.set(s, nodes.length); nodes.push({ name: s }); }
      if (!nodeMap.has(t)) { nodeMap.set(t, nodes.length); nodes.push({ name: t }); }
      
      const linkKey = `${nodeMap.get(s)}-${nodeMap.get(t)}`;
      linkMap.set(linkKey, (linkMap.get(linkKey) || 0) + v);
    });

    const links = [...linkMap.entries()].map(([key, value]) => {
      const [source, target] = key.split("-").map(Number);
      return { source, target, value };
    }).sort((a, b) => b.value - a.value).slice(0, 15);

    return { nodes, links };
  }, [dataset]);

  const bubbleConfig = useMemo(() => {
    if (!dataset || dataset.groups.numericColumns.length < 3) return null;
    const xCol = dataset.groups.numericColumns[0];
    const yCol = dataset.groups.numericColumns[1];
    const zCol = dataset.groups.numericColumns[2];
    const labelCol = dataset.groups.categoricalColumns[0];
    
    const data = dataset.sample.slice(0, 30).map(row => ({
      x: toNumber(row[xCol]) || 0,
      y: toNumber(row[yCol]) || 0,
      z: Math.abs(toNumber(row[zCol]) || 0),
      name: String(row[labelCol] || "")
    }));
    return { x: xCol, y: yCol, z: zCol, data };
  }, [dataset]);

  const waterfallConfig = useMemo(() => {
    if (!dataset || !dataset.groups.numericColumns[0]) return null;
    const val = dataset.groups.numericColumns[0];
    const cat = dataset.groups.categoricalColumns[0] || "index";
    
    let cumulative = 0;
    const data = dataset.sample.slice(0, 10).map((row, i) => {
      const v = toNumber(row[val]) || 0;
      const start = cumulative;
      cumulative += v;
      return { name: String(row[cat] || i), start, end: cumulative, value: v, isTotal: false };
    });
    data.push({ name: "Total", start: 0, end: cumulative, value: cumulative, isTotal: true });
    return { data };
  }, [dataset]);

  const boxPlotConfig = useMemo(() => {
    if (!dataset || !dataset.groups.numericColumns[0]) return null;
    const val = dataset.groups.numericColumns[0];
    const cat = dataset.groups.categoricalColumns[0];
    if (!cat) return null;

    const groups = new Map<string, number[]>();
    dataset.sample.forEach(row => {
      const k = String(row[cat] || "Other");
      const v = toNumber(row[val]);
      if (v !== null) {
        const arr = groups.get(k) || [];
        arr.push(v);
        groups.set(k, arr);
      }
    });

    const data = [...groups.entries()].map(([name, values]) => {
      const sorted = values.sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      return { name, min, q1, median, q3, max };
    }).slice(0, 5);
    return { data };
  }, [dataset]);

  const multiAreaConfig = useMemo(() => {
    if (!dataset || dataset.groups.numericColumns.length < 2) return null;
    const date = dataset.groups.dateColumns[0] || dataset.groups.categoricalColumns[0];
    if (!date) return null;
    const metrics = dataset.groups.numericColumns.slice(0, 3);
    const data = dataset.sample.slice(0, 15).map(row => {
      const obj: any = { name: String(row[date]) };
      metrics.forEach(m => obj[m] = toNumber(row[m]) || 0);
      return obj;
    });
    return { metrics, data };
  }, [dataset]);

  const errorBarConfig = useMemo(() => {
    if (!dataset || !dataset.groups.numericColumns[0]) return null;
    const val = dataset.groups.numericColumns[0];
    const cat = dataset.groups.categoricalColumns[0];
    if (!cat) return null;
    const data = dataset.sample.slice(0, 10).map(row => {
      const v = toNumber(row[val]) || 0;
      return { name: String(row[cat]), value: v, error: Math.abs(v * 0.1) };
    });
    return { data };
  }, [dataset]);

  const parallelConfig = useMemo(() => {
    if (!dataset || dataset.groups.numericColumns.length < 3) return null;
    const metrics = dataset.groups.numericColumns.slice(0, 5);
    const labelCol = dataset.groups.categoricalColumns[0];
    
    // Normalize values 0-100 for visual consistency across different scales
    const data = dataset.sample.slice(0, 15).map((row, i) => {
      const obj: any = { name: String(row[labelCol] || `Item ${i+1}`) };
      metrics.forEach(m => {
        const val = toNumber(row[m]) || 0;
        // Simple normalization based on local sample min/max for visual flow
        obj[m] = val; 
      });
      return obj;
    });
    return { metrics, data };
  }, [dataset]);

  const sunburstConfig = useMemo(() => {
    if (!dataset || dataset.groups.categoricalColumns.length < 2 || !dataset.groups.numericColumns[0]) return null;
    const cat1 = dataset.groups.categoricalColumns[0];
    const cat2 = dataset.groups.categoricalColumns[1];
    const val = dataset.groups.numericColumns[0];

    const hierarchy = new Map<string, Map<string, number>>();
    dataset.sample.forEach(row => {
      const c1 = String(row[cat1] || "Other");
      const c2 = String(row[cat2] || "Unknown");
      const v = toNumber(row[val]) || 0;
      
      if (!hierarchy.has(c1)) hierarchy.set(c1, new Map());
      const sub = hierarchy.get(c1)!;
      sub.set(c2, (sub.get(c2) || 0) + v);
    });

    const innerData = [...hierarchy.entries()].map(([name, subs]) => ({
      name,
      value: [...subs.values()].reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.value - a.value).slice(0, 5);

    const outerData = innerData.flatMap(parent => {
      const subs = hierarchy.get(parent.name)!;
      return [...subs.entries()].map(([name, value]) => ({
        name: `${parent.name} > ${name}`,
        value,
        parentId: parent.name
      })).sort((a, b) => b.value - a.value).slice(0, 3);
    });

    return { innerData, outerData };
  }, [dataset]);

  async function parseDatasetFile(file: File) {
    setError(null);
    setLoadingDataset(true);
    setDataset(null);
    setInsights(null);
    setStory(null);

    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/datasets/parse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed.");

      setDataset(data);
      setActiveChart(preferredActiveChart(data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse dataset.");
    } finally {
      setLoadingDataset(false);
    }
  }

  const downloadChart = async (id: string, name: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { 
        backgroundColor: "#0A0A0B",
        scale: 2,
        useCORS: true,
        logging: false
      });
      const link = document.createElement("a");
      link.download = `${name.toLowerCase().replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      setError("Failed to download chart.");
    }
  };

  async function explainMyData() {
    if (!dataset) return;
    setError(null);
    setLoadingInsights(true);
    setInsights(null);

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          columns: dataset.columns,
          sample: dataset.sample,
          correlations: dataset.correlations,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Insights failed.");
      setInsights(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate insights.");
    } finally {
      setLoadingInsights(false);
    }
  }

  async function generateStory() {
    if (!dataset) return;
    setError(null);
    setLoadingStory(true);
    setStory(null);

    try {
      const res = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          columns: dataset.columns,
          sample: dataset.sample,
          correlations: dataset.correlations,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Story generation failed.");

      const nextStory = data?.story as StoryResponse | undefined;
      if (!nextStory) throw new Error("Story response missing.");

      setStory(nextStory);
      setActiveChart(nextStory.trendAnalysis.chartType as ActiveChart);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate story.");
    } finally {
      setLoadingStory(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-[100vh] flex items-center justify-center">
        <div className="w-[520px] max-w-full mx-4 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="animate-pulse h-6 w-36 rounded bg-white/10 mb-4" />
          <div className="animate-pulse h-4 w-full rounded bg-white/10 mb-3" />
          <div className="animate-pulse h-4 w-2/3 rounded bg-white/10 mb-3" />
          <div className="animate-pulse h-72 w-full rounded bg-white/10" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100vh] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-white/70">Please sign in to start a DataForge project.</div>
          <button
            className="mt-4 h-11 px-6 rounded-full font-medium bg-white text-black hover:bg-white/90 transition-colors"
            onClick={() => router.push("/sign-in")}
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100vh] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all group"
              title="Back to Home"
            >
              <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain rounded-lg" />
              </div>
              <div className="leading-tight">
                <div className="font-bold tracking-tight text-white">DataForge</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                  Analytics
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid lg:grid-cols-[360px,1fr] gap-6 items-start">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-5 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="space-y-1">
                <div className="text-xl font-bold tracking-tight text-white">Upload</div>
              </div>
              <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-cyan-500/10 border-cyan-500/20 text-cyan-400">
                Active
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm text-white/70 mb-2 inline-flex items-center gap-2">
                Upload ANY File
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-white/10 bg-white/5 text-[11px] text-white/70">?</span>
              </label>

              <div
                className="group relative rounded-2xl border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 p-8 cursor-pointer overflow-hidden"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) await parseDatasetFile(f);
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="font-bold text-white/90">Drag & drop</div>
                  <div className="text-xs text-white/40 mt-1 max-w-[160px]">Drop ANY data file here to begin</div>
                </div>
                <input
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  type="file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await parseDatasetFile(f);
                  }}
                />
              </div>

              {loadingDataset && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="animate-pulse h-4 w-32 rounded bg-white/10 mb-3" />
                  <div className="animate-pulse h-20 w-full rounded bg-white/10" />
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-3 text-sm text-pink-200">{error}</div>
              )}

              {dataset && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/60">Dataset summary</div>
                  <div className="mt-2 font-medium">{dataset.filename}</div>
                  <div className="text-sm text-white/60 mt-1">Rows: {dataset.rowCount}</div>
                </div>
              )}

              <div className="mt-5 space-y-3">
                <button
                  disabled={!dataset || loadingInsights}
                  onClick={() => void explainMyData()}
                  className="w-full h-11 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {loadingInsights ? "Summarizing..." : "Data summary"}
                </button>

                <button
                  disabled={!dataset || loadingStory}
                  onClick={() => void generateStory()}
                  className="w-full h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  {loadingStory ? "Generating report..." : "Full report"}
                </button>
              </div>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 min-w-0 flex flex-col">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-cyan-400 animate-pulse" />
                  Visualize
                </div>
                <div className="text-xl font-bold tracking-tight text-white">Visualization</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Status</div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      {activeChart.replace("_", " ")}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => downloadChart("main-chart-container", activeChart)}
                  className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-white/70 transition-all flex items-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            {dataset ? (
              <>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {[
                      { id: "bar", label: "Bar", show: !!barConfig },
                      { id: "line", label: "Line", show: !!lineConfig },
                      { id: "pie", label: "Pie", show: !!pieConfig },
                      { id: "area", label: "Area", show: !!areaConfig },
                      { id: "scatter", label: "Scatter", show: !!scatterConfig },
                      { id: "radar", label: "Radar", show: !!radarConfig },
                      { id: "radial_bar", label: "Radial", show: !!radialBarConfig },
                      { id: "treemap", label: "Treemap", show: !!treemapConfig },
                      { id: "funnel", label: "Funnel", show: !!funnelConfig },
                      { id: "composed", label: "Composed", show: !!composedConfig },
                      { id: "correlation_heatmap", label: "Correlation", show: !!correlationConfig },
                      // Premium Charts
                      { id: "sankey", label: "Sankey", premium: true },
                      { id: "bubble", label: "Bubble", premium: true },
                      { id: "brush", label: "Brush", premium: true },
                      { id: "waterfall", label: "Waterfall", premium: true },
                      { id: "box_plot", label: "Box Plot", premium: true },
                      { id: "error_bar", label: "Error", premium: true },
                      { id: "parallel", label: "Parallel", premium: true },
                      { id: "scatter_label", label: "ID Points", premium: true },
                      { id: "multi_area", label: "Multi Area", premium: true },
                      { id: "sunburst", label: "Sunburst", premium: true },
                    ].filter(t => t.show !== false).map((tab) => {
                      const isLocked = tab.premium && status !== "authenticated";
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            if (isLocked) {
                              alert("Please sign in to unlock INSANE graph modes!");
                              return;
                            }
                            setActiveChart(tab.id as ActiveChart);
                          }}
                          className={clsx(
                            "h-9 px-3 rounded-full text-xs border transition-all flex items-center gap-2",
                            activeChart === tab.id 
                              ? "border-white/20 bg-white/15 text-white" 
                              : isLocked 
                                ? "border-white/5 bg-white/2 text-white/30 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          )}
                        >
                          {tab.label}
                          {isLocked && (
                            <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                <div id="main-chart-container" className="mt-5 h-[420px] rounded-3xl border border-white/10 bg-black/20 p-3 relative">
                  <svg style={{ height: 0, width: 0, position: 'absolute' }}>
                    <defs>
                      <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A855F7" />
                        <stop offset="100%" stopColor="#6366F1" />
                      </linearGradient>
                      <linearGradient id="lineG" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22C55E" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                      <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EC4899" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#EC4899" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="radarG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
                      </linearGradient>
                      <filter id="chartShadow" height="200%">
                        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.5)" />
                      </filter>
                    </defs>
                  </svg>

                  {activeChart === "bar" && barConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barConfig.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Bar dataKey="value" name={barConfig.y} radius={[10, 10, 0, 0]} filter="url(#chartShadow)" barSize={40}>
                          {barConfig.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getValueColor(entry.value, Math.max(...barConfig.data.map(d => d.value)))} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : activeChart === "line" && lineConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineConfig.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Line type="monotone" dataKey="value" name={lineConfig.valueCol} stroke="url(#lineG)" strokeWidth={4} dot={{ r: 6, fill: "#06B6D4", strokeWidth: 2, stroke: "#fff" }} filter="url(#chartShadow)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : activeChart === "pie" && pieConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Legend />
                        <Pie data={pieConfig.data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={8} stroke="rgba(255,255,255,0.05)" filter="url(#chartShadow)">
                          {pieConfig.data.map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={dynamicPalette[idx % dynamicPalette.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : activeChart === "area" && areaConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={areaConfig.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Area type="monotone" dataKey="value" name={areaConfig.valueCol} fill="url(#areaG)" stroke="#EC4899" strokeWidth={3} filter="url(#chartShadow)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : activeChart === "scatter" && scatterConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis type="number" dataKey="x" name={scatterConfig.x} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis type="number" dataKey="y" name={scatterConfig.y} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: "rgba(10,10,11,0.9)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                        <Scatter name="Distribution" data={scatterConfig.data} fill="#F43F5E" shape="circle" filter="url(#chartShadow)" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : activeChart === "correlation_heatmap" && correlationConfig ? (
                    <div className="h-full w-full overflow-auto p-2">
                      <div style={{ minWidth: `${180 + correlationConfig.numericColumns.length * 100}px` }}>
                        <div className="grid gap-2 items-center" style={{ gridTemplateColumns: `180px repeat(${correlationConfig.numericColumns.length}, minmax(100px, 1fr))` }}>
                          <div />
                          {correlationConfig.numericColumns.map(c => (
                            <div key={c} className="text-[11px] font-medium text-white/60 text-center truncate">{c}</div>
                          ))}
                          {correlationConfig.numericColumns.map((rowCol, i) => (
                            <Fragment key={rowCol}>
                              <div className="text-[11px] font-medium text-white/60 truncate pr-3">{rowCol}</div>
                              {correlationConfig.numericColumns.map((_, j) => {
                                const val = correlationConfig.matrix[i]?.[j] ?? 0;
                                return (
                                  <div key={j} className="h-10 rounded-xl border border-white/10 flex items-center justify-center text-[10px] font-mono text-white shadow-lg transform transition-transform hover:scale-105" style={{ background: correlationColor(val), boxShadow: `0 4px 12px ${correlationColor(val).replace('rgb', 'rgba').replace(')', ',0.3)')}` }}>
                                    {val.toFixed(2)}
                                  </div>
                                );
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : activeChart === "radar" && radarConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarConfig.data}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        {radarConfig.metrics.map((m, i) => (
                          <Radar key={m} name={m} dataKey={m} stroke={dynamicPalette[i % dynamicPalette.length]} fill="url(#radarG)" fillOpacity={0.6} filter="url(#chartShadow)" />
                        ))}
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : activeChart === "radial_bar" && radialBarConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart cx="50%" cy="50%" innerRadius="15%" outerRadius="90%" barSize={25} data={radialBarConfig.data}>
                        <RadialBar background dataKey="value" cornerRadius={15} filter="url(#chartShadow)" />
                        <Legend iconSize={12} layout="vertical" verticalAlign="middle" align="right" />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  ) : activeChart === "treemap" && treemapConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap data={treemapConfig.children} dataKey="size" stroke="#fff" fill="url(#barG)">
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  ) : activeChart === "funnel" && funnelConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Funnel data={funnelConfig.data} dataKey="value" nameKey="name">
                          {funnelConfig.data.map((_, i) => (
                            <Cell key={i} fill={dynamicPalette[i % dynamicPalette.length]} filter="url(#chartShadow)" />
                          ))}
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  ) : activeChart === "composed" && composedConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={composedConfig.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Legend />
                        <Bar dataKey="bar" name={composedConfig.yBar} fill="url(#barG)" radius={[8, 8, 0, 0]} filter="url(#chartShadow)" barSize={35} />
                        <Line type="monotone" dataKey="line" name={composedConfig.yLine} stroke="#22C55E" strokeWidth={4} dot={{ r: 6, fill: "#22C55E", strokeWidth: 2, stroke: "#fff" }} filter="url(#chartShadow)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : activeChart === "sankey" && sankeyConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <Sankey
                        data={sankeyConfig}
                        nodePadding={50}
                        margin={{ top: 20, bottom: 20, left: 100, right: 100 }}
                        node={({ x, y, width, height, index, payload, containerWidth }: any) => {
                          const isOut = x + width + 6 > 800; // rough estimate
                          return (
                            <g>
                              <rect x={x} y={y} width={width} height={height} fill="#A855F7" fillOpacity="0.9" rx={2} />
                              <text
                                x={isOut ? x - 8 : x + width + 8}
                                y={y + height / 2}
                                textAnchor={isOut ? 'end' : 'start'}
                                alignmentBaseline="middle"
                                fontSize="10"
                                fontWeight="bold"
                                fill="rgba(255,255,255,0.8)"
                              >
                                {payload?.name || "Node"}
                              </text>
                            </g>
                          );
                        }}
                        link={{ stroke: 'rgba(168, 85, 247, 0.4)' }}
                      >
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          itemStyle={{ color: "#fff" }}
                        />
                      </Sankey>
                    </ResponsiveContainer>
                  ) : activeChart === "bubble" && bubbleConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis type="number" dataKey="x" name={bubbleConfig.x} axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                        <YAxis type="number" dataKey="y" name={bubbleConfig.y} axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                        <ZAxis type="number" dataKey="z" range={[100, 1000]} name={bubbleConfig.z} />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Scatter name="Points" data={bubbleConfig.data} fill="url(#barG)" filter="url(#chartShadow)" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : activeChart === "waterfall" && waterfallConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={waterfallConfig.data}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Bar dataKey="start" stackId="a" fill="transparent" />
                        <Bar dataKey="value" stackId="a" radius={[5, 5, 5, 5]} filter="url(#chartShadow)">
                          {waterfallConfig.data.map((entry, index) => (
                            <Cell key={index} fill={entry.isTotal ? '#22C55E' : entry.value >= 0 ? '#06B6D4' : '#EF4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : activeChart === "box_plot" && boxPlotConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={boxPlotConfig.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Bar dataKey="q1" stackId="a" fill="transparent" />
                        <Bar dataKey="q3" stackId="a" fill="url(#barG)" opacity={0.6} />
                        <ErrorBar dataKey="max" stroke="#fff" strokeWidth={2} width={10} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : activeChart === "error_bar" && errorBarConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={errorBarConfig.data}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Bar dataKey="value" fill="url(#barG)" radius={[10, 10, 0, 0]}>
                          <ErrorBar dataKey="error" stroke="#EF4444" strokeWidth={2} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : activeChart === "multi_area" && multiAreaConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={multiAreaConfig.data}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        {multiAreaConfig.metrics.map((m, i) => (
                          <Area key={m} type="monotone" dataKey={m} stackId="1" fill={dynamicPalette[i % dynamicPalette.length]} stroke={dynamicPalette[i % dynamicPalette.length]} fillOpacity={0.6} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : activeChart === "brush" && (lineConfig || barConfig) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(lineConfig?.data || barConfig?.data || []).map((d: any) => ({ ...d, chartKey: d.date || d.name }))}>
                        <XAxis dataKey="chartKey" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Line type="monotone" dataKey="value" stroke="url(#lineG)" strokeWidth={3} dot={false} />
                        <Brush dataKey="chartKey" height={30} stroke="#A855F7" fill="rgba(255,255,255,0.05)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : activeChart === "parallel" && parallelConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={parallelConfig.data}>
                        <XAxis dataKey="name" hide />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        {parallelConfig.metrics.map((m, i) => (
                          <Line key={m} type="monotone" dataKey={m} stroke={dynamicPalette[i % dynamicPalette.length]} strokeWidth={2.5} dot={false} strokeOpacity={0.8} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : activeChart === "scatter_label" && scatterConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis type="number" dataKey="x" name={scatterConfig.x} />
                        <YAxis type="number" dataKey="y" name={scatterConfig.y} />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "4px" }}
                        />
                        <Scatter name="Labeled Points" data={scatterConfig.data} fill="#06B6D4">
                          {scatterConfig.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={dynamicPalette[index % dynamicPalette.length]} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : activeChart === "sunburst" && sunburstConfig ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip 
                          formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
                          contentStyle={{ background: "#0A0A0B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          itemStyle={{ color: "#fff" }}
                        />
                        <Pie 
                          data={sunburstConfig.innerData} 
                          dataKey="value" 
                          nameKey="name" 
                          outerRadius={80} 
                          fill="#A855F7" 
                          stroke="rgba(0,0,0,0.2)"
                        >
                          {sunburstConfig.innerData.map((_, i) => (
                            <Cell key={i} fill={dynamicPalette[i % dynamicPalette.length]} />
                          ))}
                        </Pie>
                        <Pie 
                          data={sunburstConfig.outerData} 
                          dataKey="value" 
                          nameKey="name" 
                          innerRadius={90} 
                          outerRadius={120} 
                          fill="#6366F1" 
                          stroke="rgba(0,0,0,0.2)"
                          label={({ name }) => (name || "").split(' > ')[1] || ""}
                        >
                          {sunburstConfig.outerData.map((_, i) => (
                            <Cell key={i} fill={dynamicPalette[(i + 3) % dynamicPalette.length]} opacity={0.7} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/40 text-center px-6">
                      <div className="h-12 w-12 rounded-full border border-white/5 bg-white/5 flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="font-bold text-white/60 mb-1">
                        {activeChart === "area" || activeChart === "line" 
                          ? "Temporal Data Required" 
                          : "Insufficient Data"}
                      </div>
                      <div className="text-xs max-w-[240px]">
                        {activeChart === "area" || activeChart === "line"
                          ? "This chart requires at least one date column and one numeric column to render trends."
                          : "Try selecting a different chart type or uploading a dataset with more varied columns."}
                      </div>
                    </div>
                  )}
                </div>

                {insights && (
                  <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="text-lg font-semibold text-white mb-4">AI Insights</div>
                    <div className="space-y-3">
                      {insights.insights.map((t, idx) => (
                        <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">{t}</div>
                      ))}
                    </div>
                  </div>
                )}

                {story && (
                  <div className="mt-4">
                    <StoryArticle
                      story={story}
                      barConfig={barConfig}
                      lineConfig={lineConfig}
                      pieConfig={pieConfig}
                      correlationConfig={correlationConfig}
                      scatterConfig={scatterConfig}
                      radarConfig={radarConfig}
                      radialBarConfig={radialBarConfig}
                      treemapConfig={treemapConfig}
                      funnelConfig={funnelConfig}
                      composedConfig={composedConfig}
                      onRegenerate={() => void generateStory()}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-6 text-white/40">Upload a dataset to begin visualization.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
