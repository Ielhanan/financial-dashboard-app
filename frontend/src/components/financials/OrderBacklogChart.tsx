"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useOrderBacklog } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";

export function OrderBacklogChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useOrderBacklog(ticker);

  const chartData = (data?.annual ?? []).map((a) => ({
    year: String(a.year),
    revenue_b: a.revenue / 1e9,
  }));

  return (
    <ChartWrapper
      title="Annual Revenue / Order Backlog Proxy"
      subtitle={data?.note ?? "Annual revenue shown as order backlog proxy"}
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
          formatter={(v: unknown) => [`$${Number(v).toFixed(1)}B`, "Revenue"]}
        />
        <Bar dataKey="revenue_b" name="Revenue ($B)" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={`hsl(${210 + i * 15}, 70%, 55%)`} />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}
