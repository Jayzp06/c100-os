/**
 * Centralized export infrastructure for the reporting system.
 *
 * Every report route builds its data once (the same data returned as JSON to
 * the web app) and hands it to one of these helpers to stream a CSV, XLSX, or
 * PDF file. This keeps authorization, data-fetching, and formatting logic in
 * one place so future reporting modules (Treasurer, Secretary, governance,
 * facility-use, etc.) can reuse the same export pipeline instead of each
 * hand-rolling file generation.
 */

import type { Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export function isExportFormat(v: unknown): v is ExportFormat {
  return v === "csv" || v === "xlsx" || v === "pdf";
}

export interface ReportColumn<T> {
  header: string;
  key: string;
  /** Extract a display-ready value for this column from a row. */
  value: (row: T) => string | number | boolean | null | undefined;
  /** Excel column width (characters). Defaults to a reasonable size. */
  width?: number;
}

export interface ReportSheet<T = unknown> {
  name: string;
  columns: ReportColumn<T>[];
  rows: T[];
}

export interface ReportMeta {
  title: string;
  /** Filename without extension. */
  filenameBase: string;
  /** e.g. "Trailblazing Chapter · Collegiate 100 · Fort Valley State University" */
  subtitle?: string;
  /** e.g. "Spring 2026" or a date range label. */
  period?: string | null;
  /** Short summary lines shown above the table in the PDF (label/value pairs). */
  summary?: { label: string; value: string | number }[];
  generatedAt?: Date;
}

const CHAPTER_LINE =
  "Fort Valley State University \u00b7 Collegiate 100 \u00b7 Trailblazing Chapter";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function sendCsv<T>(
  res: Response,
  meta: ReportMeta,
  columns: ReportColumn<T>[],
  rows: T[],
): void {
  const lines: string[] = [];
  lines.push(columns.map((c) => csvEscape(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(c.value(row))).join(","));
  }
  const csv = lines.join("\r\n") + "\r\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${meta.filenameBase}.csv"`,
  );
  res.send(csv);
}

export async function sendXlsx(
  res: Response,
  meta: ReportMeta,
  sheets: ReportSheet[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "C100 OS";
  workbook.created = meta.generatedAt ?? new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? Math.max(12, c.header.length + 4),
    }));
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      const record: Record<string, unknown> = {};
      for (const c of sheet.columns) record[c.key] = c.value(row) ?? "";
      ws.addRow(record);
    }
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${meta.filenameBase}.xlsx"`,
  );
  const buffer = await workbook.xlsx.writeBuffer();
  res.send(Buffer.from(buffer));
}

export function sendPdf<T>(
  res: Response,
  meta: ReportMeta,
  columns: ReportColumn<T>[],
  rows: T[],
): void {
  const doc = new PDFDocument({ margin: 40, size: "LETTER", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${meta.filenameBase}.pdf"`,
  );
  doc.pipe(res);

  drawPdfHeader(doc, meta);
  drawPdfTable(doc, columns, rows);

  doc.end();
}

/** Draws the standard chapter letterhead, title, and summary block. */
export function drawPdfHeader(doc: PDFKit.PDFDocument, meta: ReportMeta): void {
  const generated = meta.generatedAt ?? new Date();
  doc
    .fillColor("#1a3a8f")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(meta.title, { align: "left" });
  doc
    .fillColor("#444444")
    .font("Helvetica")
    .fontSize(10)
    .text(meta.subtitle ?? CHAPTER_LINE);
  doc
    .fillColor("#666666")
    .fontSize(9)
    .text(
      `Generated ${generated.toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}${meta.period ? `  \u00b7  Reporting period: ${meta.period}` : ""}`,
    );
  doc.moveDown(0.5);
  doc
    .strokeColor("#C9A227")
    .lineWidth(2)
    .moveTo(doc.x, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.75);

  if (meta.summary && meta.summary.length > 0) {
    const startY = doc.y;
    const colWidth =
      (doc.page.width - doc.page.margins.left - doc.page.margins.right) /
      meta.summary.length;
    meta.summary.forEach((item, i) => {
      const x = doc.page.margins.left + i * colWidth;
      doc
        .fillColor("#888888")
        .font("Helvetica")
        .fontSize(8)
        .text(item.label.toUpperCase(), x, startY, { width: colWidth - 8 });
      doc
        .fillColor("#111111")
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(String(item.value), x, startY + 12, { width: colWidth - 8 });
    });
    doc.y = startY + 40;
    doc.moveDown(0.5);
  }
}

/** Draws a simple paginated table for the given columns/rows. */
export function drawPdfTable<T>(
  doc: PDFKit.PDFDocument,
  columns: ReportColumn<T>[],
  rows: T[],
): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const totalWidth = right - left;
  const colWidth = totalWidth / columns.length;
  const rowHeight = 18;

  function drawHeaderRow() {
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#ffffff");
    doc.rect(left, doc.y, totalWidth, rowHeight).fill("#1a3a8f");
    const y = doc.y - rowHeight;
    columns.forEach((c, i) => {
      doc
        .fillColor("#ffffff")
        .text(c.header, left + i * colWidth + 4, y + 5, {
          width: colWidth - 8,
          ellipsis: true,
        });
    });
    doc.y = y + rowHeight;
    doc.fillColor("#111111").font("Helvetica").fontSize(8.5);
  }

  doc.y += 4;
  drawHeaderRow();

  rows.forEach((row, idx) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHeaderRow();
    }
    const y = doc.y;
    if (idx % 2 === 1) {
      doc.rect(left, y, totalWidth, rowHeight).fill("#f4f5f7");
      doc.fillColor("#111111");
    }
    columns.forEach((c, i) => {
      const raw = c.value(row);
      const text = raw === null || raw === undefined ? "" : String(raw);
      doc.text(text, left + i * colWidth + 4, y + 5, {
        width: colWidth - 8,
        ellipsis: true,
      });
    });
    doc.y = y + rowHeight;
  });

  if (rows.length === 0) {
    doc
      .fillColor("#666666")
      .font("Helvetica-Oblique")
      .fontSize(9)
      .text("No records for this report.", left, doc.y + 10);
  }
}
