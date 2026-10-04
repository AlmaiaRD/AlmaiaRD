"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useMemo, useState } from "react";
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
  classNameRow?: string;
  classNameCell?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  loading?: boolean;
  loadingRows?: number;
  rowKey?: keyof T | ((row: T) => string);
}

function getValueByKey<T>(obj: T, key: string): unknown {
  return (obj as Record<string, unknown>)[key];
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return String(a).localeCompare(String(b));
}

interface VirtualRowProps<T> {
  row: T;
  index: number;
  columns: Column<any>[];
  rowHeight: number;
  onRowClick?: (row: any, index: number) => void;
  striped?: boolean;
  hoverable?: boolean;
}

function VirtualRow<T>({
  row,
  index,
  columns,
  rowHeight,
  onRowClick,
  striped,
  hoverable,
}: VirtualRowProps<any>) {
  return (
    <div
      className={`flex ${index % 2 === 1 ? "bg-[#FAF6F0]" : ""} hover:bg-[#FAF6F0] transition-colors cursor-pointer`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: `${rowHeight}px`,
        transform: `translateY(${index * rowHeight}px)`,
      }}
      role="row"
      onClick={() => onRowClick && onRowClick(row, index)}
    >
      {columns.map((col, colIndex) => (
        <div
          key={`${col.key}-${index}`}
          className="flex items-center px-4"
          style={{
            width: col.width ? `${col.width}px` : undefined,
            minWidth: col.minWidth ? `${col.minWidth}px` : "80px",
            maxWidth: col.maxWidth ? `${col.maxWidth}px` : undefined,
          }}
          role="gridcell"
        >
          {col.render ? (
            col.render(row, index)
          ) : (
            <span className="text-sm text-[#5C3E35]">
              {String((row as Record<string, unknown>)[col.key] ?? "")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function VirtualTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowHeight = 56,
  overscan = 5,
  height = "600px",
  width = "100%",
  emptyMessage = "No hay datos para mostrar",
  emptyIcon,
  onRowClick,
  striped = true,
  hoverable = true,
  stickyHeader = true,
  className = "",
  classNameHeader = "",
  classNameRow = "",
  classNameCell = "",
  sortBy,
  sortOrder,
  onSort,
  loading = false,
  loadingRows = 10,
  rowKey = "id",
}: VirtualTableProps<any>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [sortState, setSortState] = useState<{ by: string; order: "asc" | "desc" }>({
    by: sortBy || "",
    order: sortOrder || "asc",
  });

  const rowKeyFn = useMemo(() => {
    if (typeof rowKey === "function") return rowKey;
    return (row: any) => String((row as Record<string, unknown>)[rowKey as string] ?? "");
  }, [rowKey]);

  const virtualizer = useVirtualizer({
    count: loading ? 10 : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
    paddingStart: 0,
    paddingEnd: 0,
  });

  const handleSort = (key: string) => {
    if (!onSort) return;
    if (sortState.by === key) {
      onSort(key);
      setSortState({ by: key, order: sortState.order === "asc" ? "desc" : "asc" });
    } else {
      onSort(key);
      setSortState({ by: key, order: "asc" });
    }
  };

  const getSortIcon = (key: string) => {
    if (sortState.by !== key) return <ChevronUp className="w-4 h-4 text-[#9C8A82] opacity-50" />;
    return sortState.order === "asc"
      ? <ChevronUp className="w-4 h-4 text-[#B8837E]" />
      : <ChevronDown className="w-4 h-4 text-[#B8837E]" />;
  };

  const sortedData = useMemo(() => {
    if (!sortState.by || !onSort) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortState.by];
      const bVal = (b as Record<string, unknown>)[sortState.by];
      const comparison = compareValues(aVal, bVal);
      return sortState.order === "asc" ? comparison : -comparison;
    });
  }, [data, sortState, onSort]);

  const displayData = loading ? Array.from({ length: 10 }, (_, i) => ({})) : (sortState.by && onSort ? sortedData : data);

  if (displayData.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#9C8A82]">
        {emptyIcon || (
          <svg className="w-16 h-16 opacity-40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  const styleHeight = typeof height === "number" ? `${height}px` : height;
  const styleWidth = typeof width === "number" ? `${width}px` : width;

  return (
    <div
      ref={parentRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: typeof height === "number" ? `${height}px` : height, width: typeof width === "number" ? `${width}px` : width }}
      tabIndex={0}
    >
      <div className="overflow-hidden">
        <div
          className={`flex border-b border-[#E8E0D8] bg-[#FCFAF7] ${classNameHeader} ${stickyHeader ? "sticky top-0 z-10" : ""}`}
          role="row"
        >
          {columns.map((col, colIndex) => (
            <div
              key={col.key}
              className={`flex items-center px-4 py-3 text-xs font-semibold text-[#9C8A82] uppercase tracking-wider ${col.align === "center" ? "justify-center" : col.align === "right" ? "justify-end" : ""} ${col.sortable ? "cursor-pointer select-none hover:text-[#5C3E35]" : ""} transition-colors`}
              style={{
                width: col.width ? `${col.width}px` : undefined,
                minWidth: col.minWidth ? `${col.minWidth}px` : "80px",
                maxWidth: col.maxWidth ? `${col.maxWidth}px` : undefined,
              }}
              onClick={() => col.sortable && handleSort(col.key)}
              role="columnheader"
              aria-sort={
                sortState.by === col.key
                  ? sortState.order === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <span className="flex items-center gap-1">{col.header}</span>
              {col.sortable && <span className="ml-1">{getSortIcon(col.key)}</span>}
            </div>
          ))}
        </div>

        <div className="relative" style={{ height: `calc(100% - 44px)` }}>
          <div
            style={{
              height: `${displayData.length * rowHeight}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <VirtualRow
                key={loading ? virtualRow.index : displayData[virtualRow.index].id}
                row={displayData[virtualRow.index]}
                index={virtualRow.index}
                columns={columns}
                rowHeight={rowHeight}
                onRowClick={onRowClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

