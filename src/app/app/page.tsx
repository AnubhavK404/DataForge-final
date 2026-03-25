"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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
import clsx from "clsx";

import StoryArticle, {
  type StoryResponse,
  type BarConfig,
  type LineConfig,
  type PieConfig,
  type CorrelationConfig,
} from "./components/StoryArticle";

/* ================= TYPES ================= */

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
  error?: string; // ✅ FIX
};

type InsightsResponse = {
  suggestions: string[];
  insights: string[];
  error?: string; // ✅ FIX
};

/* ================= HELPERS ================= */

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toTimestamp(v: unknown): number | null {
  if (v == null) return null;
  const t = typeof v === "number" ? v : Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

function formatDateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function correlationColor(value: number) {
  const t = (Math.max(-1, Math.min(1, value)) + 1) / 2;
  return `rgb(${Math.round(255 * (1 - t))},${Math.round(
    100 * (1 - Math.abs(t - 0.5) * 2)
  )},${Math.round(255 * t)})`;
}

/* ================= PAGE ================= */

export default function AppPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const { beginnerMode, saving: beginnerSaving, setBeginnerMode } =
    useBeginnerMode();

  const [dataset, setDataset] =
    useState<ParsedDatasetResponse | null>(null);
  const [insights, setInsights] =
    useState<InsightsResponse | null>(null);

  const [loadingDataset, setLoadingDataset] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState("bar");

  /* ================= FETCH FIX ================= */

  const handleUpload = async (file: File) => {
    setError(null);
    setLoadingDataset(true);

    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/datasets/parse", {
        method: "POST",
        body: fd,
      });

      const data = (await res.json()) as ParsedDatasetResponse;

      if (!res.ok) {
        throw new Error(data.error ?? "Parse failed");
      }

      setDataset(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoadingDataset(false);
    }
  };

  const handleInsights = async () => {
    if (!dataset) return;

    setLoadingInsights(true);

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dataset),
      });

      const data = (await res.json()) as InsightsResponse;

      if (!res.ok) {
        throw new Error(data.error ?? "Insights failed");
      }

      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Insights failed");
    } finally {
      setLoadingInsights(false);
    }
  };

  /* ================= UI ================= */

  if (status === "loading") return <div>Loading...</div>;

  if (!session) {
    return (
      <button onClick={() => router.push("/sign-in")}>
        Sign in
      </button>
    );
  }

  return (
    <div className="p-6">
      <h1>DataForge</h1>

      <input
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />

      {loadingDataset && <p>Uploading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {dataset && (
        <>
          <h2>{dataset.filename}</h2>

          <button onClick={handleInsights}>
            Generate Insights
          </button>

          {loadingInsights && <p>Loading insights...</p>}

          {insights?.insights.map((i, idx) => (
            <p key={idx}>{i}</p>
          ))}
        </>
      )}
    </div>
  );
}