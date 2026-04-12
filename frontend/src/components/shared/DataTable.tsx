"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface Column<T> {
  key: keyof T;
  label: string;
  format?: (val: T[keyof T]) => string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  exportFilename?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  title,
  exportFilename = "export",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortAsc
          ? av < bv ? -1 : av > bv ? 1 : 0
          : av > bv ? -1 : av < bv ? 1 : 0;
      })
    : data;

  function exportXLSX() {
    const rows = sorted.map((row) =>
      Object.fromEntries(
        columns.map((col) => [
          col.label,
          col.format ? col.format(row[col.key]) : String(row[col.key] ?? ""),
        ])
      )
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `${exportFilename}.xlsx`);
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            onClick={exportXLSX}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Export XLSX
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-left cursor-pointer hover:text-gray-200 select-none"
                >
                  {col.label}
                  {sortKey === col.key ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                className="border-t border-gray-800 hover:bg-gray-800 transition-colors"
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-2 text-gray-200">
                    {col.format
                      ? col.format(row[col.key])
                      : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
