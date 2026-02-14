import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parsePaymentFile, type ParseResult } from "@/lib/file-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extFromFilename(name: string): string {
  const parts = name.split(".");
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

function sheetRowsToCsv(rows: unknown[][]): string {
  // Simple CSV conversion: quote fields with commas/quotes/newlines.
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v).trim();
    if (/[\",\n\r]/.test(s)) return `"${s.replace(/\"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

async function parsePdfToText(buf: Buffer): Promise<string> {
  // pdf-parse is CJS; use dynamic import to keep Next bundler happier.
  const mod: unknown = await import("pdf-parse");
  const maybeDefault = (mod as { default?: unknown } | null)?.default;
  const pdfParse = (typeof maybeDefault === "function" ? maybeDefault : mod) as unknown;
  if (typeof pdfParse !== "function") {
    throw new Error("pdf-parse module did not export a function");
  }
  const out = await pdfParse(buf);
  return String(out?.text ?? "");
}

async function parseExcelToCsv(buf: Buffer): Promise<string> {
  const workbook = XLSX.read(buf, { type: "buffer" });
  const name = workbook.SheetNames[0];
  if (!name) return "";
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];
  return sheetRowsToCsv(rows);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const filename = file.name || "upload";
    const ext = extFromFilename(filename);
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    let content = "";
    if (ext === "csv" || ext === "txt") {
      content = Buffer.from(buf).toString("utf8");
    } else if (ext === "xlsx" || ext === "xls") {
      content = await parseExcelToCsv(buf);
    } else if (ext === "pdf") {
      content = await parsePdfToText(buf);
    } else {
      return NextResponse.json(
        { error: `Unsupported file format: .${ext || "unknown"}` },
        { status: 400 },
      );
    }

    const result: ParseResult = parsePaymentFile(content, filename);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 500 },
    );
  }
}
