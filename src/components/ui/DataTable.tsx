"use client";

import { cn } from "@/lib/utils";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";

interface DataTableProps<TData> {
  table: TanStackTable<TData>;
  className?: string;
  maxHeight?: string;
}

export default function DataTable<TData>({ table, className, maxHeight }: DataTableProps<TData>) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className={maxHeight ? `overflow-y-auto ${maxHeight}` : ""}>
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="bg-card rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5 text-sm text-foreground">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getRowModel().rows.length === 0 && (
        <div className="text-center py-12 text-text-muted">No se encontraron registros</div>
      )}
    </div>
  );
}
