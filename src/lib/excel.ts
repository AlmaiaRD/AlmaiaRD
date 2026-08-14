import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface ExportColumn {
  header: string;
  key: string;
}

export async function exportToExcel(
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Datos");

  // Headers
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: Math.max(col.header.length, 12),
  }));

  // Rows
  data.forEach((item) => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      row[col.key] = item[col.key] ?? "";
    });
    worksheet.addRow(row);
  });

  // Auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // Write and download
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
}

export async function exportTableToExcel(
  tableId: string,
  filename: string
): Promise<void> {
  const table = document.getElementById(tableId);
  if (!table) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Datos");

  // Convert HTML table to rows
  const rows = Array.from(table.querySelectorAll("tr"));
  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    cells.forEach((cell, colIndex) => {
      worksheet.getCell(rowIndex + 1, colIndex + 1).value = cell.textContent?.trim() || "";
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
}

function computeColWidths(rows: Record<string, any>[]): { width: number }[] {
  const widths: Record<number, number> = {};
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value], colIndex) => {
      const len = Math.max(String(key).length, value == null ? 0 : String(value).length);
      widths[colIndex] = Math.max(widths[colIndex] || 0, len);
    });
  });
  return Object.entries(widths).map(([, w]) => ({ width: Math.min(Math.max(w, 12), 60) }));
}

export async function exportBackupToExcel(
  tables: Record<string, Record<string, any>[]>,
  filename: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  Object.entries(tables).forEach(([name, rows]) => {
    const sheetName = (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    if (rows.length === 0) return;

    // Headers from first row keys
    const keys = Object.keys(rows[0]);
    worksheet.columns = keys.map((key, idx) => ({
      header: key,
      key,
      width: computeColWidths(rows)[idx]?.width || 12,
    }));

    rows.forEach((row) => {
      const flat: Record<string, any> = {};
      Object.entries(row).forEach(([key, value]) => {
        flat[key] = value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value ?? "";
      });
      worksheet.addRow(flat);
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: keys.length },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
}