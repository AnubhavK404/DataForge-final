"use client";

import { useMemo, useState } from "react";
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

import { useBeginnerMode } from "@/context/beginner-mode-context";

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
} from "recharts";

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

type ActiveChart = "bar" | "line" | "pie" | "correlation_heatmap";

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[$,]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toTimestamp(v: unknown): number | null {
  if (v === null || v === undefined) return null;
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
  // value: -1..1
  const clamped = Math.max(-1, Math.min(1, value));
  const t = (clamped + 1) / 2; // 0..1
  const r = Math.round(255 * (1 - t));
  const g = Math.round(100 * (1 - Math.abs(t - 0.5) * 2));
  const b = Math.round(255 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function preferredActiveChart(dataset: ParsedDatasetResponse): ActiveChart {
  if (
    dataset.groups.dateColumns.length &&
    dataset.groups.numericColumns.length
  ) {
    return "line";
  }
  if (
    dataset.groups.categoricalColumns.length &&
    dataset.groups.numericColumns.length
  ) {
    return "bar";
  }
  return dataset.groups.categoricalColumns.length ? "pie" : "bar";
}

export default function AppPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { beginnerMode, saving: beginnerSaving, setBeginnerMode } =
    useBeginnerMode();

  const plan = (session?.user?.plan ?? "FREE") as "FREE" | "PRO";

  const [dataset, setDataset] = useState<ParsedDatasetResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [story, setStory] = useState<StoryResponse | null>(null);

  const [loadingDataset, setLoadingDataset] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingStory, setLoadingStory] = useState(false);

  const [activeChart, setActiveChart] = useState<ActiveChart>("bar");
  const [error, setError] = useState<string | null>(null);

  const barConfig = useMemo<BarConfig | null>(() => {
    if (!dataset) return null;
    const x = dataset.groups.categoricalColumns[0] ?? null;
    const y = dataset.groups.numericColumns[0] ?? null;
    if (!x || !y) return null;

    const sums = new Map<string, { sum: number; n: number }>();
    for (const row of dataset.sample) {
      const xVal = row[x];
      const xKey =
        xVal === null || xVal === undefined ? "" : String(xVal).trim();
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
    const valueCol = dataset.groups.numericColumns[0] ?? null;
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
    const catCol = dataset.groups.categoricalColumns[0] ?? null;
    if (!catCol) return null;

    const counts = new Map<string, number>();
    for (const row of dataset.sample) {
      const v = row[catCol];
      const key =
        v === null || v === undefined ? "" : String(v).trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const data = [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { catCol, data };
  }, [dataset]);

  const correlationConfig = useMemo<CorrelationConfig | null>(() => {
    if (!dataset?.correlations) return null;
    return {
      numericColumns: dataset.correlations.numericColumns,
      matrix: dataset.correlations.matrix,
    };
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
      const data = (await res.json()) as ParsedDatasetResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Parse failed.");

      setDataset(data);
      setActiveChart(preferredActiveChart(data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse dataset.");
    } finally {
      setLoadingDataset(false);
    }
  }

  async function explainMyData() {
    if (!dataset) return;
    setError(null);
    setLoadingInsights(true);
    setInsights(null);

    if (plan === "FREE") {
      setLoadingInsights(false);
      setError("AI insights are a Pro feature. Upgrade to unlock them.");
      return;
    }

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
      const data = (await res.json()) as InsightsResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Insights failed.");
      setInsights(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate insights."
      );
    } finally {
      setLoadingInsights(false);
    }
  }

  async function generateStory() {
    if (!dataset) return;
    setError(null);
    setLoadingStory(true);
    setStory(null);

    if (plan === "FREE") {
      setLoadingStory(false);
      setError("Storytelling is a Pro feature. Upgrade to unlock it.");
      return;
    }

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
      if (!res.ok)
        throw new Error(data?.error ?? "Story generation failed.");

      const nextStory = data?.story as StoryResponse | undefined;
      if (!nextStory) throw new Error("Story response missing.");

      setStory(nextStory);
      setActiveChart(nextStory.trendAnalysis.chartType as ActiveChart);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate story."
      );
    } finally {
      setLoadingStory(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-[100vh] flex items-center justify-center">
        <div className="w-[520px] rounded-3xl border border-white/10 bg-white/5 p-6">
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
          <div className="text-white/70">
            Please sign in to start a DataForge project.
          </div>
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
        <div className="mx-auto w-full max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-cyan-400 to-pink-500" />
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">DataForge</div>
              <div className="text-xs text-white/60">
                Tier: {plan === "PRO" ? "Pro" : "Free"} · Beginner Mode:{" "}
                {beginnerMode ? "On" : "Off"}
              </div>
            </div>
          </div>

          <label
            title="Beginner Mode hides advanced controls and explains what to do."
            className="inline-flex items-center gap-2 text-xs text-white/60 select-none cursor-pointer"
          >
            <input
              type="checkbox"
              checked={beginnerMode}
              disabled={beginnerSaving}
              onChange={(e) => void setBeginnerMode(e.target.checked)}
            />
            Beginner Mode
          </label>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid lg:grid-cols-[360px,1fr] gap-6 items-start">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-white/60">1) Upload data</div>
                <div className="text-lg font-semibold tracking-tight mt-1">
                  Instant Dataset Magic
                </div>
              </div>
              <div
                className={clsx(
                  "px-3 py-1 rounded-full text-xs border border-white/10",
                  beginnerMode
                    ? "bg-white/5"
                    : "bg-cyan-300/10 border-cyan-300/20"
                )}
              >
                {beginnerMode ? "Beginner" : "Advanced"}
              </div>
            </div>

            <div className="mt-5">
              <label
                className="block text-sm text-white/70 mb-2 inline-flex items-center gap-2"
                title="Upload a CSV, Excel file, or JSON. We’ll auto-detect columns and visualize it."
              >
                Upload CSV / Excel / JSON
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-white/10 bg-white/5 text-[11px] text-white/70">
                  ?
                </span>
              </label>

              <div
                className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (!f) return;
                  await parseDatasetFile(f);
                }}
              >
                <div className="text-center">
                  <div className="font-medium">Drag & drop</div>
                  <div className="text-sm text-white/60 mt-1">
                    or pick a file to begin.
                  </div>
                </div>
                <input
                  className="mt-4 w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-white/80"
                  type="file"
                  accept=".csv,.xlsx,.xls,.json,.txt"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    await parseDatasetFile(f);
                  }}
                />
              </div>

              {loadingDataset ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="animate-pulse h-4 w-32 rounded bg-white/10 mb-3" />
                  <div className="animate-pulse h-20 w-full rounded bg-white/10" />
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-3 text-sm text-pink-200">
                  {error}
                </div>
              ) : null}

              {dataset ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/60">Dataset summary</div>
                  <div className="mt-2 font-medium">{dataset.filename}</div>
                  <div className="text-sm text-white/60 mt-1">
                    Rows: {dataset.sample.length} (sample) / {dataset.rowCount} (total)
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {dataset.groups.numericColumns.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80"
                      >
                        {c}
                      </span>
                    ))}
                    {dataset.groups.numericColumns.length > 3 ? (
                      <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/60">
                        +{dataset.groups.numericColumns.length - 3} more
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                <button
                  disabled={!dataset || loadingInsights}
                  onClick={() => void explainMyData()}
                  className="w-full h-11 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    plan === "FREE"
                      ? "AI insights are a Pro feature."
                      : "Generates insights in plain language."
                  }
                >
                  {loadingInsights
                    ? beginnerMode
                      ? "Looking..."
                      : "Explaining..."
                    : beginnerMode
                      ? "Tell me about my data"
                      : "Explain my data"}
                </button>

                <button
                  disabled={!dataset || loadingStory}
                  onClick={() => void generateStory()}
                  className="w-full h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    plan === "FREE"
                      ? "Storytelling is a Pro feature."
                      : "Creates a structured, scrollable narrative with charts and PDF export."
                  }
                >
                  {loadingStory
                    ? beginnerMode
                      ? "Writing story..."
                      : "Generating story..."
                    : beginnerMode
                      ? "Tell a story"
                      : "Storytelling mode"}
                </button>

                {beginnerMode ? (
                  <div className="mt-1 text-xs text-white/60">
                    Tip: Upload a file, then click{" "}
                    <span className="text-white/80 font-medium">
                      Tell me about my data
                    </span>
                    .
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-white/60">2) Visualize</div>
                <div className="text-lg font-semibold tracking-tight mt-1">
                  Smart Visualization Engine
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/60">Active</div>
                <div className="text-sm font-medium">
                  {activeChart === "correlation_heatmap"
                    ? "Correlation heatmap"
                    : activeChart[0].toUpperCase() +
                      activeChart.slice(1).replaceAll("_", " ")}
                </div>
              </div>
            </div>

            {dataset ? (
              <>
                {!beginnerMode ? (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {(insights?.suggestions?.length
                      ? (insights.suggestions as ActiveChart[])
                      : (["bar", "line", "pie", "correlation_heatmap"] as ActiveChart[])
                    )
                      .slice(0, 4)
                      .map((key) => (
                        <button
                          key={key}
                          onClick={() => setActiveChart(key)}
                          className={clsx(
                            "h-9 px-3 rounded-full text-xs border transition-colors",
                            activeChart === key
                              ? "border-white/20 bg-white/15 text-white"
                              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          )}
                          title="Switch the visualization."
                        >
                          {key === "correlation_heatmap"
                            ? "Correlation"
                            : key[0].toUpperCase() + key.slice(1)}
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-white/60">
                    Best chart selected for you.
                  </div>
                )}

                <div className="mt-5 h-[420px] rounded-3xl border border-white/10 bg-black/20 p-3">
                  {activeChart === "bar" && barConfig ? (
                    <div
                      className="h-full w-full"
                      style={{ minWidth: 0, minHeight: 0 }}
                    >
                      <ResponsiveContainer width={600} height={396}>
                        <BarChart data={barConfig.data}>
                          <XAxis
                            dataKey="name"
                            tick={{ fill: "rgba(255,255,255,0.7)" }}
                          />
                          <YAxis
                            tick={{ fill: "rgba(255,255,255,0.7)" }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(0,0,0,0.6)",
                              border:
                                "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 12,
                            }}
                          />
                          <Bar
                            dataKey="value"
                            fill="#60a5fa"
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}

                  {activeChart === "line" && lineConfig ? (
                    <div
                      className="h-full w-full"
                      style={{ minWidth: 0, minHeight: 0 }}
                    >
                      <ResponsiveContainer width={600} height={396}>
                        <LineChart data={lineConfig.data}>
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "rgba(255,255,255,0.7)" }}
                          />
                          <YAxis
                            tick={{ fill: "rgba(255,255,255,0.7)" }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(0,0,0,0.6)",
                              border:
                                "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 12,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#22c55e"
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}

                  {activeChart === "pie" && pieConfig ? (
                    <div
                      className="h-full w-full"
                      style={{ minWidth: 0, minHeight: 0 }}
                    >
                      <ResponsiveContainer width={600} height={396}>
                        <PieChart>
                          <Tooltip
                            contentStyle={{
                              background: "rgba(0,0,0,0.6)",
                              border:
                                "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 12,
                            }}
                          />
                          <Pie
                            data={pieConfig.data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={110}
                            paddingAngle={3}
                          >
                            {pieConfig.data.map((_entry, idx) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={
                                  [
                                    "#6366f1",
                                    "#22c55e",
                                    "#06b6d4",
                                    "#fb7185",
                                    "#f59e0b",
                                  ][idx % 5]
                                }
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}

                  {activeChart === "correlation_heatmap" &&
                  correlationConfig ? (
                    <div className="h-full w-full overflow-auto p-2">
                      <div className="min-w-[520px]">
                        <div
                          className="grid gap-1"
                          style={{
                            gridTemplateColumns: `130px repeat(${correlationConfig.numericColumns.length}, 1fr)`,
                          }}
                        >
                          <div className="text-xs text-white/50 py-2"> </div>
                          {correlationConfig.numericColumns.map((c) => (
                            <div
                              key={c}
                              className="text-xs text-white/60 py-2 border-b border-white/10"
                            >
                              {c}
                            </div>
                          ))}
                          {correlationConfig.numericColumns.map((rowCol, i) => (
                            <>
                              <div
                                key={rowCol}
                                className="text-xs text-white/60 py-2 border-r border-white/10 pr-2"
                              >
                                {rowCol}
                              </div>
                              {correlationConfig.numericColumns.map((_col, j) => {
                                const value =
                                  correlationConfig.matrix[i]?.[j] ?? 0;
                                return (
                                  <div
                                    key={`${rowCol}-${j}`}
                                    className="h-8 rounded-lg border border-white/10"
                                    style={{
                                      background: correlationColor(value),
                                      opacity: 0.92,
                                    }}
                                    title={`r ≈ ${value.toFixed(2)}`}
                                  />
                                );
                              })}
                            </>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {!barConfig && activeChart === "bar" ? (
                    <div className="h-full flex items-center justify-center text-white/70 px-4 text-center">
                      Not enough columns for a bar chart. Upload data with a categorical + numeric column.
                    </div>
                  ) : null}
                  {!lineConfig && activeChart === "line" ? (
                    <div className="h-full flex items-center justify-center text-white/70 px-4 text-center">
                      Not enough columns for a line chart. Upload data with a date + numeric column.
                    </div>
                  ) : null}
                  {!pieConfig && activeChart === "pie" ? (
                    <div className="h-full flex items-center justify-center text-white/70 px-4 text-center">
                      Not enough columns for a pie chart. Upload data with a categorical column.
                    </div>
                  ) : null}
                  {!correlationConfig &&
                  activeChart === "correlation_heatmap" ? (
                    <div className="h-full flex items-center justify-center text-white/70 px-4 text-center">
                      Not enough numeric columns to build a correlation heatmap.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-white/60">3) AI Insights Panel</div>
                      <div className="text-lg font-semibold tracking-tight mt-1">
                        {beginnerMode
                          ? "What’s happening?"
                          : "What’s happening in your data"}
                      </div>
                    </div>
                  </div>

                  {loadingInsights ? (
                    <div className="mt-4 space-y-3">
                      <div className="animate-pulse h-5 w-2/3 rounded bg-white/10" />
                      <div className="animate-pulse h-5 w-5/6 rounded bg-white/10" />
                      <div className="animate-pulse h-5 w-1/2 rounded bg-white/10" />
                    </div>
                  ) : null}

                  {insights ? (
                    <div className="mt-4 space-y-3">
                      {(beginnerMode
                        ? insights.insights.slice(0, 3)
                        : insights.insights
                      ).map((t, idx) => (
                        <div
                          key={`${idx}-${t.slice(0, 16)}`}
                          className="rounded-2xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="text-sm text-white/80 leading-6">
                            {t}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !loadingInsights ? (
                    <div className="mt-4 text-sm text-white/60">
                      {plan === "FREE" ? (
                        <>Upgrade to Pro to unlock AI insights.</>
                      ) : (
                        <>
                          Click{" "}
                          <span className="text-white/80 font-medium">
                            {beginnerMode
                              ? "Tell me about my data"
                              : "Explain my data"}
                          </span>{" "}
                          to generate insights.
                        </>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  {story || loadingStory ? (
                    loadingStory && !story ? (
                      <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6">
                        <div className="animate-pulse h-6 w-44 rounded bg-white/10 mb-4" />
                        <div className="animate-pulse h-4 w-full rounded bg-white/10 mb-3" />
                        <div className="animate-pulse h-4 w-5/6 rounded bg-white/10 mb-3" />
                        <div className="animate-pulse h-72 w-full rounded bg-white/10" />
                      </div>
                    ) : story ? (
                      <StoryArticle
                        key={story.title}
                        story={story}
                        plan={plan}
                        barConfig={barConfig}
                        lineConfig={lineConfig}
                        pieConfig={pieConfig}
                        correlationConfig={correlationConfig}
                        onRegenerate={() => void generateStory()}
                      />
                    ) : null
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-6 text-white/70">
                Upload a dataset to see auto-suggested charts, AI insights, and a storytelling article.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

