// ── Shared CSV export helper ──
// Uses comma separator + UTF-8 BOM so files open correctly in Excel-pt-BR.
// Values containing comma, quote or newline are quoted; embedded quotes doubled.

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportCSV(filename: string, headers: string[], rows: unknown[][]) {
  const headerLine = headers.map(escapeField).join(',');
  const bodyLines = rows.map((r) => r.map(escapeField).join(',')).join('\n');
  const csv = '﻿' + headerLine + '\n' + bodyLines;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvFilename(prefix: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${prefix}_${today}.csv`;
}
