"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useRatios } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";
import { useChartColors } from "@/hooks/useChartColors";

export function RatiosModule() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useRatios(ticker);
  const c = useChartColors();

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
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
          <XAxis type="number" tick={{ fill: c.tick, fontSize: 10 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: c.tick, fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, color: c.tooltipText }}
            labelStyle={{ color: c.tooltipText }}
            itemStyle={{ color: c.tooltipText }}
            cursor={{ fill: "transparent" }}
            formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}x`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: c.tick }} />
          <Bar dataKey="value" name={ticker} fill={c.blue} radius={[0, 4, 4, 0]} activeBar={false} />
          <Bar dataKey="sector" name="Sector Avg" fill={c.gray} radius={[0, 4, 4, 0]} activeBar={false} />
        </BarChart>
      </ChartWrapper>

      <ChartWrapper
        title="P/FCF & D/E — 5-Year Historical"
        subtitle="Price-to-Free-Cash-Flow and Debt-to-Equity trend"
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <BarChart data={historicalChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
          <XAxis dataKey="year" tick={{ fill: c.tick, fontSize: 11 }} />
          <YAxis tick={{ fill: c.tick, fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, color: c.tooltipText }}
            labelStyle={{ color: c.tooltipText }}
            itemStyle={{ color: c.tooltipText }}
            cursor={{ fill: "transparent" }}
            formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}x`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: c.tick }} />
          <Bar dataKey="p_fcf" name="P/FCF" fill={c.purple} radius={[4, 4, 0, 0]} activeBar={false} />
          <Bar dataKey="d_e" name="D/E" fill={c.amber} radius={[4, 4, 0, 0]} activeBar={false} />
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
