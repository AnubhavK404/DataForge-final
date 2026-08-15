import { NextResponse } from "next/server";
import { createHash } from "crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type ColumnType = "number" | "date" | "string";

type ParsedColumn = {
  name: string;
  type: ColumnType;
  nonNullCount: number;
  uniqueCount: number;
};

function normalizeHeaders(headers: string[]) {
  return headers.map((h) =>
    (h ?? "")
      .toString()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s-]/g, "")
  );
}

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

function parseDate(v: unknown): number | null {
  const s = toCleanString(v);
  if (!s || s.length < 4) return null;
  
  // Prevent purely numeric strings from being parsed as dates (e.g. "2023" -> Jan 1 2023)
  // unless they look like years and we want that? Actually, standard "2023" is better as a number.
  if (/^\d+$/.test(s) && s.length !== 4) return null;

  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  
  // Sanity check: dates should generally be between 1900 and 2100 for most business data
  const year = new Date(t).getFullYear();
  if (year < 1900 || year > 2100) return null;
  
  return t;
}

function pearsonCorrelation(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mx = mean(xs);
  const my = mean(ys);

  let num = 0;
  let dx = 0;
  let dy = 0;

  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }

  const den = Math.sqrt(dx * dy);
  if (!den) return null;
  return num / den;
}

function inferColumnType(name: string, values: unknown[]): ColumnType {
  const nonNull = values.filter(
    (v) => v !== null && v !== undefined && toCleanString(v) !== ""
  );

  if (nonNull.length === 0) return "string";

  const numbers = nonNull.map((v) => parseNumber(v));
  const dateTimes = nonNull.map((v) => parseDate(v));

  const numberCount = numbers.filter((n) => n !== null).length;
  const dateCount = dateTimes.filter((t) => t !== null).length;

  // Semantic hint from column name
  const lowName = name.toLowerCase();
  const nameLooksLikeDate = lowName.includes("date") || lowName.includes("time") || lowName.includes("hire") || lowName.includes("at") || lowName.includes("on");

  if (numberCount / nonNull.length >= 0.9) return "number";
  
  if (nameLooksLikeDate && dateCount / nonNull.length >= 0.4) return "date";
  if (dateCount / nonNull.length >= 0.9) return "date";

  return "string";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const jsonText = form.get("json") as string | null;

    if (!file && (!jsonText || !jsonText.trim())) {
      return NextResponse.json(
        { error: "Provide a file upload or paste JSON." },
        { status: 400 }
      );
    }

    let filename = "uploaded";
    let rawBuffer: Buffer | null = null;
    let rows: Record<string, unknown>[] = [];

    if (file) {
      filename = file.name ?? "uploaded";
      const arrayBuffer = await file.arrayBuffer();
      rawBuffer = Buffer.from(arrayBuffer);
      const ext = (filename.split(".").pop() ?? "").toLowerCase();

      if (ext === "csv" || ext === "txt") {
        const text = rawBuffer.toString("utf-8");
        const parsed = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        rows = (parsed.data ?? []).filter(
          (row) =>
            row &&
            typeof row === "object" &&
            Object.keys(row).length > 0 &&
            Object.values(row).some((val) => val !== null && val !== "")
        );
      } else if (ext === "json") {
        const text = rawBuffer.toString("utf-8");
        const obj = JSON.parse(text);
        if (Array.isArray(obj)) rows = obj;
        else if (obj && Array.isArray(obj.records)) rows = obj.records;
        else throw new Error("JSON must be an array of objects or { records: [...] }.");
      } else if (ext === "xlsx" || ext === "xls") {
        const workbook = XLSX.read(rawBuffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      } else {
        // AI Fallback for ANY file format
        const text = rawBuffer.toString("utf-8");
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          return NextResponse.json(
            { error: "Unsupported file type and AI fallback is not configured." },
            { status: 400 }
          );
        }

        const OpenAI = (await import("openai")).default;
        const groq = new OpenAI({ 
          apiKey,
          baseURL: "https://api.groq.com/openai/v1"
        });

        const prompt = `Extract tabular data from the following text into a JSON array of objects.
        DATA:
        ${text.substring(0, 15000)}`;
        
        try {
          const aiResponse = await groq.chat.completions.create({
            model: "qwen-2.5-32b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
          });

          let content = aiResponse.choices[0]?.message?.content?.trim() || "[]";
          if (content.startsWith("```")) {
            content = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
          }

          const parsedObj = JSON.parse(content);
          rows = Array.isArray(parsedObj) ? parsedObj : (parsedObj.records || [parsedObj]);
        } catch (err) {
          throw new Error("AI could not parse this file format.");
        }
      }
    } else if (jsonText) {
      const obj = JSON.parse(jsonText);
      rows = Array.isArray(obj) ? obj : (obj.records || []);
    }

    rows = rows.filter((r) => r && typeof r === "object");
    if (!rows.length) throw new Error("No rows found.");

    const sha256 = rawBuffer ? createHash("sha256").update(rawBuffer).digest("hex") : "no-file-hash";
    const columnNames = normalizeHeaders(Object.keys(rows[0] ?? {}));
    const columnKeyByIndex = Object.keys(rows[0] ?? {});

    const normalizedRows = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (let i = 0; i < columnNames.length; i++) {
        out[columnNames[i]] = r[columnKeyByIndex[i]];
      }
      return out;
    });

    const sampleForInference = normalizedRows.slice(0, 500);
    const columns: ParsedColumn[] = columnNames.map((name) => {
      const values = sampleForInference.map((r) => r[name]);
      const nonNullCount = values.filter((v) => toCleanString(v) !== "").length;
      const uniqueCount = new Set(values.map((v) => toCleanString(v)).filter(Boolean)).size;
      const type = inferColumnType(name, values);
      return { name, type, nonNullCount, uniqueCount };
    });

    const numericColumns = columns.filter((c) => c.type === "number").map((c) => c.name);
    const dateColumns = columns.filter((c) => c.type === "date").map((c) => c.name);
    const categoricalColumns = columns.filter((c) => c.type === "string").map((c) => c.name);

    const numericForCorr = numericColumns.slice(0, 8);
    const correlations: number[][] = [];

    for (let i = 0; i < numericForCorr.length; i++) {
      const rowArr: number[] = [];
      for (let j = 0; j < numericForCorr.length; j++) {
        const xs: number[] = [];
        const ys: number[] = [];
        for (const r of normalizedRows.slice(0, 2000)) {
          const xv = parseNumber(r[numericForCorr[i]]);
          const yv = parseNumber(r[numericForCorr[j]]);
          if (xv !== null && yv !== null) {
            xs.push(xv);
            ys.push(yv);
          }
        }
        const corr = pearsonCorrelation(xs, ys);
        rowArr.push(corr === null ? 0 : corr);
      }
      correlations.push(rowArr);
    }

    return NextResponse.json({
      sha256,
      filename,
      rowCount: normalizedRows.length,
      columns,
      groups: { numericColumns, dateColumns, categoricalColumns },
      sample: normalizedRows.slice(0, 1000),
      correlations: numericForCorr.length ? { numericColumns: numericForCorr, matrix: correlations } : null,
    }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Parse failed" }, { status: 400 });
  }
}