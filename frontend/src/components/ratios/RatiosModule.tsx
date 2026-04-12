"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useRatios } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";

export function RatiosModule() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useRatios(ticker);

  const benchmarkChartData = (data?.current ?? []).map((r) => ({
    name: r.name,
    value: r.value ?? 0,
    sector: r.sector_average ?? 0,
  }));

  const historicalChartData = (data?.historical ?? []).map((h) => ({
    year: String(h.year),
    p_fcf: h.p_fcf ?? 0,
    d_e: h.d_e ?? 0,
  }));

  return (
    <div className="space-y-4">
      <ChartWrapper
        title="Valuation Ratios vs Sector Average"
        subtitle="P/E, P/B, EV/EBITDA, P/FCF, D/E — company vs sector median"
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <BarChart data={benchmarkChartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}x`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar dataKey="value" name={ticker} fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="sector" name="Sector Avg" fill="#6b7280" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartWrapper>

      <ChartWrapper
        title="P/FCF & D/E — 5-Year Historical"
        subtitle="Price-to-Free-Cash-Flow and Debt-to-Equity trend"
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <BarChart data={historicalChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}x`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar dataKey="p_fcf" name="P/FCF" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="d_e" name="D/E" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartWrapper>

      <DataTable
        title="Current Ratios"
        exportFilename={`${ticker}-ratios`}
        data={(data?.current ?? []).map((r) => ({
          name: r.name,
          value: r.value,
          sector_average: r.sector_average,
          vs_sector: r.value != null && r.sector_average != null
            ? `${((r.value / r.sector_average - 1) * 100).toFixed(1)}%`
            : "—",
        }))}
        columns={[
          { key: "name", label: "Ratio" },
          { key: "value", label: "Current", format: (v) => v != null ? `${(v as number).toFixed(1)}x` : "—" },
          { key: "sector_average", label: "Sector Avg", format: (v) => v != null ? `${(v as number).toFixed(1)}x` : "—" },
          { key: "vs_sector", label: "vs Sector" },
        ]}
      />
    </div>
  );
}
