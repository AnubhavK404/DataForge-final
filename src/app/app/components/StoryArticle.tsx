"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
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
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type StoryChartType = "bar" | "line" | "pie" | "correlation_heatmap";

export type StoryResponse = {
  title: string;
  keyInsights: string[];
  keyInsightsChartType: StoryChartType;
  trendAnalysis: { text: string; chartType: StoryChartType };
  notablePatterns: { text: string; chartType: StoryChartType };
  recommendations: string[];
};

export type BarConfig = { x: string; y: string; data: { name: string; value: number }[] };
export type LineConfig = {
  dateCol: string;
  valueCol: string;
  data: { date: string; value: number }[];
};
export type PieConfig = { catCol: string; data: { name: string; value: number }[] };
export type CorrelationConfig = {
  numericColumns: string[];
  matrix: number[][];
};

function correlationColor(value: number) {
  // value: -1..1
  const clamped = Math.max(-1, Math.min(1, value));
  const t = (clamped + 1) / 2; // 0..1
  // red (negative) -> blue (positive)
  const r = Math.round(255 * (1 - t));
  const g = Math.round(100 * (1 - Math.abs(t - 0.5) * 2));
  const b = Math.round(255 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center text-white/50">
      Generating chart…
    </div>
  );
}

export default function StoryArticle({
  story,
  plan,
  barConfig,
  lineConfig,
  pieConfig,
  correlationConfig,
  onRegenerate,
}: {
  story: StoryResponse;
  plan: "PRO" | "FREE";
  barConfig: BarConfig | null;
  lineConfig: LineConfig | null;
  pieConfig: PieConfig | null;
  correlationConfig: CorrelationConfig | null;
  onRegenerate: () => Promise<void> | void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const palette = useMemo(
    () => ["#6366f1", "#22c55e", "#06b6d4", "#fb7185", "#f59e0b"],
    []
  );

  async function exportStoryPdf() {
    if (!ref.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      // Multi-page image slicing: slice based on how much of the scaled image fits per A4 page.
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      const sliceHeightPx = Math.max(
        1,
        Math.floor((pageHeight / imgHeight) * canvas.height)
      );

      let renderedHeightPx = 0;
      let pageIndex = 0;
      while (renderedHeightPx < canvas.height) {
        if (pageIndex > 0) pdf.addPage();

        const sliceCanvas = document.createElement("canvas");
        const currentSliceHeightPx = Math.min(
          sliceHeightPx,
          canvas.height - renderedHeightPx
        );
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeightPx;

        const sliceCtx = sliceCanvas.getContext("2d");
        if (!sliceCtx) throw new Error("Slice context unavailable");

        sliceCtx.drawImage(
          canvas,
          0,
          renderedHeightPx,
          canvas.width,
          currentSliceHeightPx,
          0,
          0,
          canvas.width,
          currentSliceHeightPx
        );

        const sliceData = sliceCanvas.toDataURL("image/png");
        const sliceImgProps = pdf.getImageProperties(sliceData);
        const sliceImgHeightMm = (sliceImgProps.height * imgWidth) / sliceImgProps.width;

        pdf.addImage(sliceData, "PNG", 0, 0, imgWidth, sliceImgHeightMm);

        renderedHeightPx += currentSliceHeightPx;
        pageIndex++;
      }

      const safeTitle = story.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 50);
      pdf.save(`${safeTitle}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  function RenderChart({
    type,
  }: {
    type: StoryChartType;
  }) {
    if (type === "bar" && barConfig?.data?.length) {
      return (
        <div className="h-full w-full" style={{ minWidth: 0, minHeight: 0 }}>
          <ResponsiveContainer width={520} height={240}>
            <BarChart data={barConfig.data}>
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.7)" }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.7)" }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="value" fill="#60a5fa" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === "line" && lineConfig?.data?.length) {
      return (
        <div className="h-full w-full" style={{ minWidth: 0, minHeight: 0 }}>
          <ResponsiveContainer width={520} height={240}>
            <LineChart data={lineConfig.data}>
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.7)" }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.7)" }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.12)",
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
      );
    }

    if (type === "pie" && pieConfig?.data?.length) {
      return (
        <div className="h-full w-full" style={{ minWidth: 0, minHeight: 0 }}>
          <ResponsiveContainer width={520} height={240}>
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                }}
              />
              <Pie
                data={pieConfig.data}
                dataKey="value"
                nameKey="name"
                innerRadius={40}
                outerRadius={90}
                paddingAngle={3}
              >
                {pieConfig.data.map((_entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === "correlation_heatmap" && correlationConfig?.numericColumns.length) {
      return (
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
                  <div className="text-xs text-white/60 py-2 border-r border-white/10 pr-2" key={rowCol}>
                    {rowCol}
                  </div>
                  {correlationConfig.numericColumns.map((_col, j) => {
                    const value = correlationConfig.matrix[i]?.[j] ?? 0;
                    return (
                      <div
                        key={`${rowCol}-${j}`}
                        className="h-8 rounded-lg border border-white/10"
                        style={{ background: correlationColor(value), opacity: 0.92 }}
                        title={`r ≈ ${value.toFixed(2)}`}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return <ChartSkeleton />;
  }

  const watermark = plan === "FREE";

  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="px-6 pt-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-white/60">Storytelling mode</div>
          <div className="text-xl font-semibold tracking-tight mt-1">{story.title}</div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            onClick={() => onRegenerate()}
            title="Rewrites the story using the same dataset (faster in Pro tier)."
            className="h-10 px-4 rounded-xl text-sm border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
          >
            Regenerate Story
          </button>
          <button
            onClick={() => exportStoryPdf()}
            title={plan === "FREE" ? "Exports with a Free watermark." : "Exports your story as a clean PDF."}
            disabled={exporting}
            className="h-10 px-4 rounded-xl text-sm bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export Story as PDF"}
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="relative px-6 pb-6"
        key={`${story.title}`}
      >
        {watermark ? (
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.35) 50%, transparent 55%)",
              transform: "rotate(-12deg) scale(1.2)",
            }}
          >
            <div className="absolute top-10 left-[-40px] text-[64px] font-black tracking-tight text-white/50">
              DATAFORGE
            </div>
          </div>
        ) : null}

        <div className="relative z-10 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <article className="max-w-3xl">
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <div className="text-lg font-semibold mb-2">Key Insights</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {story.keyInsights.map((t, idx) => (
                      <div
                        key={`${idx}-${t.slice(0, 18)}`}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <div className="text-sm text-white/85 leading-6">{t}</div>
                      </div>
                    ))}
                  </div>
                  <div className="h-[260px] rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                    <RenderChart type={story.keyInsightsChartType} />
                  </div>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.06 }}
                className="mt-6"
              >
                <div className="text-lg font-semibold mb-2">Trend Analysis</div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/80 leading-7">{story.trendAnalysis.text}</div>
                </div>
                <div className="h-[260px] mt-4 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                  <RenderChart type={story.trendAnalysis.chartType} />
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.12 }}
                className="mt-6"
              >
                <div className="text-lg font-semibold mb-2">Notable Patterns</div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/80 leading-7">{story.notablePatterns.text}</div>
                </div>
                <div className="h-[280px] mt-4 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                  <RenderChart type={story.notablePatterns.chartType} />
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.18 }}
                className="mt-6"
              >
                <div className="text-lg font-semibold mb-2">Recommendations</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    {story.recommendations.map((t, idx) => (
                      <div
                        key={`${idx}-${t.slice(0, 18)}`}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <div className="text-sm text-white/85 leading-6">{t}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            </article>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

