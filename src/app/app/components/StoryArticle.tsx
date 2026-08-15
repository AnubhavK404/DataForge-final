"use client";

import { useMemo, useRef, useState, Fragment } from "react";
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
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export type StoryChartType = "bar" | "line" | "pie" | "correlation_heatmap" | "area" | "scatter" | "radar" | "radial_bar" | "treemap" | "funnel" | "composed";

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
  const clamped = Math.max(-1, Math.min(1, value));
  const t = (clamped + 1) / 2; // 0..1
  const r = Math.round(255 * (1 - t));
  const g = Math.round(100 * (1 - Math.abs(t - 0.5) * 2));
  const b = Math.round(255 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center text-white/50 text-xs">
      Generating visualization…
    </div>
  );
}

export default function StoryArticle({
  story,
  barConfig,
  lineConfig,
  pieConfig,
  correlationConfig,
  scatterConfig,
  radarConfig,
  radialBarConfig,
  treemapConfig,
  funnelConfig,
  composedConfig,
  onRegenerate,
}: {
  story: StoryResponse;
  barConfig: BarConfig | null;
  lineConfig: LineConfig | null;
  pieConfig: PieConfig | null;
  correlationConfig: CorrelationConfig | null;
  scatterConfig: { x: string; y: string; data: { x: number; y: number; name: string }[] } | null;
  radarConfig: { metrics: string[]; data: any[] } | null;
  radialBarConfig: { cat: string; val: string; data: any[] } | null;
  treemapConfig: { name: string; children: any[] } | null;
  funnelConfig: { data: any[] } | null;
  composedConfig: { x: string; yBar: string; yLine: string; data: any[] } | null;
  onRegenerate: () => Promise<void> | void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const dynamicPalette = useMemo(() => {
    const hues = [260, 280, 310, 340, 10, 180, 160];
    const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);
    const selectedHues = shuffle(hues);
    return selectedHues.map(h => `hsl(${h}, 70%, 60%)`);
  }, [story]);

  const getValueColor = (val: number, max: number) => {
    const ratio = val / (max || 1);
    if (ratio > 0.8) return "#22C55E";
    if (ratio < 0.2) return "#EF4444";
    return "url(#barG_s)";
  };

  async function exportStoryPdf() {
    if (!ref.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: "#000",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let renderedHeightPx = 0;
      const sliceHeightPx = Math.floor((pageHeight / imgHeight) * canvas.height);

      while (renderedHeightPx < canvas.height) {
        if (renderedHeightPx > 0) pdf.addPage();
        const sliceCanvas = document.createElement("canvas");
        const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - renderedHeightPx);
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeightPx;
        const sliceCtx = sliceCanvas.getContext("2d");
        if (sliceCtx) {
          sliceCtx.drawImage(canvas, 0, renderedHeightPx, canvas.width, currentSliceHeightPx, 0, 0, canvas.width, currentSliceHeightPx);
          const sliceData = sliceCanvas.toDataURL("image/png");
          const sliceImgHeightMm = (currentSliceHeightPx * imgWidth) / canvas.width;
          pdf.addImage(sliceData, "PNG", 0, 0, imgWidth, sliceImgHeightMm);
        }
        renderedHeightPx += currentSliceHeightPx;
      }

      pdf.save(`${story.title.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  function RenderChart({ type }: { type: StoryChartType }) {
    if (type === "bar" && barConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barConfig.data}>
            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip 
              formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
              contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} 
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} filter="url(#chartShadow_s)">
              {barConfig.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getValueColor(entry.value, Math.max(...barConfig.data.map(d => d.value)))} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (type === "line" && lineConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={lineConfig.data}>
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip 
              formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
              contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} 
            />
            <Line type="monotone" dataKey="value" stroke="url(#lineG_s)" strokeWidth={3} dot={{ r: 4, fill: "#06B6D4", strokeWidth: 1, stroke: "#fff" }} filter="url(#chartShadow_s)" />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    if (type === "area" && lineConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={lineConfig.data}>
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip 
              formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
              contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} 
            />
            <Area type="monotone" dataKey="value" fill="url(#areaG_s)" stroke="#EC4899" strokeWidth={2} filter="url(#chartShadow_s)" />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    if (type === "pie" && pieConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Tooltip 
              formatter={(value: any, name: any) => [new Intl.NumberFormat().format(Number(value || 0)), name]}
              contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} 
            />
            <Pie data={pieConfig.data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={6} stroke="rgba(255,255,255,0.05)" filter="url(#chartShadow_s)">
              {pieConfig.data.map((_, idx) => (
                <Cell key={idx} fill={dynamicPalette[idx % dynamicPalette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if (type === "scatter" && scatterConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis type="number" dataKey="x" name={scatterConfig.x} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="y" name={scatterConfig.y} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Scatter name="Data" data={scatterConfig.data} fill="#F43F5E" shape="circle" filter="url(#chartShadow_s)" />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
    if (type === "correlation_heatmap" && correlationConfig) {
      return (
        <div className="h-full w-full overflow-auto p-2 scrollbar-hide">
          <div style={{ minWidth: `${correlationConfig.numericColumns.length * 80}px` }}>
            <div className="grid gap-1" style={{ gridTemplateColumns: `100px repeat(${correlationConfig.numericColumns.length}, 1fr)` }}>
              <div />
              {correlationConfig.numericColumns.map((c: string) => <div key={c} className="text-[9px] text-white/40 truncate text-center">{c}</div>)}
              {correlationConfig.numericColumns.map((rowCol: string, i: number) => (
                <Fragment key={rowCol}>
                  <div className="text-[9px] text-white/40 truncate">{rowCol}</div>
                  {correlationConfig.numericColumns.map((_: any, j: number) => {
                    const val = correlationConfig.matrix[i]?.[j] ?? 0;
                    return <div key={j} className="h-8 rounded-lg border border-white/10 shadow-lg" style={{ background: correlationColor(val), boxShadow: `0 2px 8px ${correlationColor(val).replace('rgb', 'rgba').replace(')', ',0.2)')}` }} title={`r ≈ ${val.toFixed(2)}`} />;
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (type === "radar" && radarConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarConfig.data}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 8 }} />
            {radarConfig.metrics.map((m, i) => (
              <Radar key={m} name={m} dataKey={m} stroke={dynamicPalette[i % dynamicPalette.length]} fill="url(#radarG_s)" fillOpacity={0.5} filter="url(#chartShadow_s)" />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      );
    }
    if (type === "radial_bar" && radialBarConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <RadialBarChart cx="50%" cy="50%" innerRadius="15%" outerRadius="80%" barSize={12} data={radialBarConfig.data}>
            <RadialBar background dataKey="value" cornerRadius={6} filter="url(#chartShadow_s)" />
          </RadialBarChart>
        </ResponsiveContainer>
      );
    }
    if (type === "treemap" && treemapConfig?.children?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <Treemap data={treemapConfig.children} dataKey="size" stroke="#fff" fill="url(#barG_s)" />
        </ResponsiveContainer>
      );
    }
    if (type === "funnel" && funnelConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <FunnelChart>
            <Funnel data={funnelConfig.data} dataKey="value" nameKey="name">
              {funnelConfig.data.map((_, i) => (
                <Cell key={i} fill={dynamicPalette[i % dynamicPalette.length]} filter="url(#chartShadow_s)" />
              ))}
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      );
    }
    if (type === "composed" && composedConfig?.data?.length) {
      return (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={composedConfig.data}>
            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 8 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 8 }} axisLine={false} tickLine={false} />
            <Bar dataKey="bar" fill="url(#barG_s)" radius={[4, 4, 0, 0]} filter="url(#chartShadow_s)" />
            <Line type="monotone" dataKey="line" stroke="#22C55E" strokeWidth={3} dot={{ r: 4, fill: "#22C55E", strokeWidth: 1, stroke: "#fff" }} filter="url(#chartShadow_s)" />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
    return <ChartSkeleton />;
  }

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-6 py-6 border-b border-white/5 flex flex-col md:flex-row items-start md:justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Report</div>
          <h2 className="text-2xl font-bold text-white">{story.title}</h2>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => onRegenerate()} className="flex-1 md:flex-none h-10 px-6 rounded-xl text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">Regenerate</button>
          <button onClick={() => exportStoryPdf()} disabled={exporting} className="flex-1 md:flex-none h-10 px-6 rounded-xl text-xs font-bold bg-white text-black hover:bg-white/90 transition-all disabled:opacity-50">{exporting ? "Exporting..." : "Export PDF"}</button>
        </div>
      </div>

      <div ref={ref} className="bg-[#0A0A0B] p-8 space-y-12 relative">
        <svg style={{ height: 0, width: 0, position: 'absolute' }}>
          <defs>
            <linearGradient id="barG_s" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="lineG_s" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="areaG_s" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EC4899" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#EC4899" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="radarG_s" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2} />
            </linearGradient>
            <filter id="chartShadow_s" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.5)" />
            </filter>
          </defs>
        </svg>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/30 mb-6">Insights</h3>
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              {story.keyInsights.map((insight, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-sm text-white/70 leading-relaxed border-l-2 border-l-indigo-500">{insight}</motion.div>
              ))}
            </div>
            <div className="h-[280px] rounded-2xl border border-white/5 bg-black/40 p-4"><RenderChart type={story.keyInsightsChartType} /></div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/30 mb-6">Trends</h3>
          <div className="grid lg:grid-cols-[1fr,400px] gap-8">
            <div className="h-[300px] rounded-2xl border border-white/5 bg-black/40 p-4"><RenderChart type={story.trendAnalysis.chartType} /></div>
            <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] text-sm text-white/60 leading-relaxed italic flex items-center justify-center text-center">"{story.trendAnalysis.text}"</div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/30 mb-6">Patterns</h3>
          <div className="grid lg:grid-cols-[400px,1fr] gap-8">
            <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] text-sm text-white/60 leading-relaxed flex items-center">{story.notablePatterns.text}</div>
            <div className="h-[300px] rounded-2xl border border-white/5 bg-black/40 p-4"><RenderChart type={story.notablePatterns.chartType} /></div>
          </div>
        </section>

        <section className="pt-8 border-t border-white/5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/30 mb-6">Recommendations</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {story.recommendations.map((rec, i) => (
              <div key={i} className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-300/80 leading-relaxed">
                <span className="font-bold text-indigo-400 mr-2">NOTE:</span> {rec}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
