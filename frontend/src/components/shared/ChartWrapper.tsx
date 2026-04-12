"use client";

import { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  height?: number;
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
}

export function ChartWrapper({
  title,
  subtitle,
  height = 280,
  children,
  isLoading = false,
  error = null,
}: ChartWrapperProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      {isLoading && (
        <div
          className="flex items-center justify-center text-gray-500 text-sm"
          style={{ height }}
        >
          Loading...
        </div>
      )}

      {error && (
        <div
          className="flex items-center justify-center text-red-400 text-sm"
          style={{ height }}
        >
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <ResponsiveContainer width="100%" height={height}>
          {children as React.ReactElement<unknown>}
        </ResponsiveContainer>
      )}
    </div>
  );
}
