/** Small helpers for CSV downloads and print-to-PDF pages. */
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function csvResponse(name: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(`﻿${body}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type PrintSection = { title: string; sub?: string; header: string[]; rows: unknown[][] };

/** A clean page that opens the print dialog, so "Save as PDF" gives the file. */
export function pdfResponse(title: string, sections: PrintSection[]) {
  const body = sections
    .map(
      (s) => `<section><h2>${esc(s.title)}</h2>${s.sub ? `<p class="sub">${esc(s.sub)}</p>` : ""}
<table><thead><tr>${s.header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
        s.rows.length
          ? s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
          : `<tr><td colspan="${s.header.length}" class="none">Nobody yet</td></tr>`
      }</tbody></table></section>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font:13px/1.4 system-ui,sans-serif;color:#111;margin:24px}
h1{font-size:20px;margin:0 0 16px}h2{font-size:15px;margin:0 0 2px}.sub{margin:0 0 6px;color:#555}
section{margin-bottom:22px;break-inside:avoid-page}table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #ddd}th{background:#f3f3f3}.none{color:#777}
@media print{body{margin:0}section{page-break-after:auto}}
</style></head><body><h1>${esc(title)}</h1>${body}<script>addEventListener("load",()=>setTimeout(()=>print(),300))</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
