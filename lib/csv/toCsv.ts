// =====================================================================
// PLOTRAS — CSV export utility
// =====================================================================
// Phase 2 scope: "Enterprise reporting." Kept deliberately simple —
// client-side conversion of data already loaded into a dashboard,
// rather than a new backend reporting pipeline. That's an honest scope
// match for what institutions actually need at this stage (pull their
// own portfolio/activity out to a spreadsheet), not a full BI system.
// =====================================================================

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);

  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
