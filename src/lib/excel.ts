import * as XLSX from "xlsx";

interface ExportColumn {
  header: string;
  key: string;
}

export function exportToExcel(
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
): void {
  const rows = data.map((item) => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      row[col.header] = item[col.key] ?? "";
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");

  const colWidths = columns.map((col) => ({
    wch: Math.max(col.header.length, 12),
  }));
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportTableToExcel(
  tableId: string,
  filename: string
): void {
  const table = document.getElementById(tableId);
  if (!table) return;
  const ws = XLSX.utils.table_to_sheet(table);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function computeColWidths(rows: Record<string, any>[]): { wch: number }[] {
  const widths: number[] = [];
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      const len = Math.max(String(key).length, value == null ? 0 : String(value).length);
      widths[Object.keys(row).indexOf(key)] = Math.max(widths[Object.keys(row).indexOf(key)] || 0, len);
    });
  });
  return widths.map((w) => ({ wch: Math.min(Math.max(w, 12), 60) }));
}

export function exportBackupToExcel(
  tables: Record<string, Record<string, any>[]>,
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  Object.entries(tables).forEach(([name, rows]) => {
    const sheetRows = rows.map((row) => {
      const flat: Record<string, any> = {};
      Object.entries(row).forEach(([key, value]) => {
        flat[key] = value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value ?? "";
      });
      return flat;
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = computeColWidths(sheetRows);
    const sheetName = (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Datos");
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
