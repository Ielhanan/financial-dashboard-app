"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useOrderBacklog } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { useChartColors } from "@/hooks/useChartColors";

export function OrderBacklogChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useOrderBacklog(ticker);
  const c = useChartColors();

  const chartData = (data?.annual ?? []).map((a) => ({
    year: String(a.year),
    revenue_b: a.revenue / 1e9,
  }));

  const barColors = [c.blue, "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"];

  return (
    <ChartWrapper
      title="Annual Revenue / Order Backlog Proxy"
      subtitle={data?.note ?? "Annual revenue shown as order backlog proxy"}
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis dataKey="year" tick={{ fill: c.tick, fontSize: 11 }} />
        <YAxis tick={{ fill: c.tick, fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, color: c.tooltipText }}
          labelStyle={{ color: c.tooltipText }}
          itemStyle={{ color: c.tooltipText }}
          cursor={{ fill: "transparent" }}
          formatter={(v: unknown) => [`$${Number(v).toFixed(1)}B`, "Revenue"]}
        />
        <Bar dataKey="revenue_b" name="Revenue ($B)" radius={[4, 4, 0, 0]} activeBar={false}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={barColors[i % barColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}
