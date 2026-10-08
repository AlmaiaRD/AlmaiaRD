"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  overscan?: number;
  height?: number | string;
  width?: number | string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  striped?: boolean;
  hoverable?: boolean;
  stickyHeader?: boolean;
  className?: string;
  classNameHeader?: string;
  classNameCell?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  loading?: boolean;
  loadingRows?: number;
  getRowKey: (row: T, index: number) => string;
}

const ALIGN_CLASS: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "",
  center: "justify-center",
  right: "justify-end",
};

function cellStyle<T>(col: Column<T>): React.CSSProperties {
  return {
    width: col.width ? `${col.width}px` : undefined,
    minWidth: col.minWidth ? `${col.minWidth}px` : "80px",
    maxWidth: col.maxWidth ? `${col.maxWidth}px` : undefined,
  };
}

function VirtualRow<T>({
  row,
  index,
  offset,
  columns,
  rowHeight,
  striped,
  hoverable,
  onRowClick,
  classNameCell,
}: {
  row: T;
  index: number;
  offset: number;
  columns: Column<T>[];
  rowHeight: number;
  striped: boolean;
  hoverable: boolean;
  onRowClick?: (row: T, index: number) => void;
  classNameCell?: string;
}) {
  const stripe = striped && index % 2 === 1 ? "bg-[#F1E9DF]" : "";
  const hover = hoverable && onRowClick ? "hover:bg-[#F1E9DF] cursor-pointer transition-colors" : "";

  return (
    <div
      role="row"
      className={`flex ${stripe} ${hover}`}
      style={{
        position: "absolute",
        top: `${offset}px`,
        left: 0,
        width: "100%",
        height: `${rowHeight}px`,
      }}
      onClick={() => onRowClick?.(row, index)}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          role="gridcell"
          className={`flex items-center px-4 ${ALIGN_CLASS[col.align ?? "left"]} ${classNameCell ?? ""} ${col.className ?? ""}`}
          style={cellStyle(col)}
        >
          {col.render ? (
            col.render(row, index)
          ) : (
            <span className="text-sm text-[#39484F]">
              {String((row as Record<string, unknown>)[col.key] ?? "")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function LoadingRow<T>({
  offset,
  columns,
  rowHeight,
}: {
  offset: number;
  columns: Column<T>[];
  rowHeight: number;
}) {
  return (
    <div
      role="row"
      aria-hidden="true"
      className="flex"
      style={{
        position: "absolute",
        top: `${offset}px`,
        left: 0,
        width: "100%",
        height: `${rowHeight}px`,
      }}
    >
      {columns.map((col) => (
        <div key={col.key} className="flex items-center px-4" style={cellStyle(col)}>
          <div className="h-4 w-3/4 rounded bg-[#E0DAD3] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * Tabla que solo dibuja las filas visibles. El ordenamiento NO lo hace este
 * componente: la pagina que lo usa ordena sus datos y le pasa sortBy /
 * sortOrder ya resueltos. Asi el ordenamiento vive en un solo lugar y aqui
 * no hay que adivinar como se llama un campo anidado ("products.name").
 */
export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 56,
  overscan = 5,
  height = 600,
  width = "100%",
  emptyMessage = "No hay datos para mostrar",
  emptyIcon,
  onRowClick,
  striped = true,
  hoverable = true,
  stickyHeader = true,
  className = "",
  classNameHeader = "",
  classNameCell = "",
  sortBy,
  sortOrder = "asc",
  onSort,
  loading = false,
  loadingRows = 10,
  getRowKey,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = loading ? loadingRows : data.length;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  if (!loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#4C5760]">
        {emptyIcon ?? (
          <svg className="w-16 h-16 opacity-40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`relative overflow-auto ${className}`}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
      }}
      tabIndex={0}
      role="grid"
      aria-rowcount={rowCount}
      aria-busy={loading || undefined}
    >
      <div
        role="row"
        className={`flex border-b border-[#E0DAD3] bg-[#F5EFE9] ${classNameHeader} ${stickyHeader ? "sticky top-0 z-10" : ""}`}
      >
        {columns.map((col) => {
          const active = sortBy === col.key;
          return (
            <div
              key={col.key}
              role="columnheader"
              aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              className={`flex items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#4C5760] ${ALIGN_CLASS[col.align ?? "left"]} ${col.sortable ? "cursor-pointer select-none hover:text-[#39484F] transition-colors" : ""}`}
              style={cellStyle(col)}
              onClick={() => col.sortable && onSort?.(col.key)}
            >
              <span className="flex items-center gap-1">{col.header}</span>
              {col.sortable &&
                (active ? (
                  sortOrder === "asc" ? (
                    <ChevronUp size={14} className="text-[#BA4A3A]" />
                  ) : (
                    <ChevronDown size={14} className="text-[#BA4A3A]" />
                  )
                ) : (
                  <ChevronUp size={14} className="opacity-40" />
                ))}
            </div>
          );
        })}
      </div>

      <div className="relative" style={{ height: `${rowCount * rowHeight}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const offset = virtualRow.start;
          if (loading) {
            return <LoadingRow key={virtualRow.key} offset={offset} columns={columns} rowHeight={rowHeight} />;
          }
          const row = data[virtualRow.index];
          return (
            <VirtualRow
              key={getRowKey(row, virtualRow.index)}
              row={row}
              index={virtualRow.index}
              offset={offset}
              columns={columns}
              rowHeight={rowHeight}
              striped={striped}
              hoverable={hoverable}
              onRowClick={onRowClick}
              classNameCell={classNameCell}
            />
          );
        })}
      </div>
    </div>
  );
}

export default VirtualTable;
