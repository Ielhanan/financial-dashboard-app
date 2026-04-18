"use client";

import { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  height?: number;
  fillHeight?: boolean;
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
}

export function ChartWrapper({
  title,
  subtitle,
  height = 280,
  fillHeight = false,
  children,
  isLoading = false,
  error = null,
}: ChartWrapperProps) {
  return (
    <div className={`card p-4 ${fillHeight ? "h-full flex flex-col" : ""}`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style={{ height: fillHeight ? undefined : height, flex: fillHeight ? 1 : undefined }}>
          Loading…
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center text-red-500 dark:text-red-400 text-sm" style={{ height: fillHeight ? undefined : height, flex: fillHeight ? 1 : undefined }}>
          {error}
        </div>
      )}

      {!isLoading && !error && (
        fillHeight ? (
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              {children as React.ReactElement<unknown>}
            </ResponsiveContainer>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {children as React.ReactElement<unknown>}
          </ResponsiveContainer>
        )
      )}
    </div>
  );
}
