// Builds a CSV from a header row and data rows and hands it to the browser as a download.
// The leading BOM makes Excel read the file as UTF-8, so accented names and peso signs survive.
export function downloadCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = headers ? [headers, ...rows] : rows;
  const csv = lines.map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
