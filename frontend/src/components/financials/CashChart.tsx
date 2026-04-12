"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useCash } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";

export function CashChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useCash(ticker);

  const chartData = (data?.quarterly ?? []).map((q) => ({
    period: q.period,
    cash_b: q.cash / 1e9,
    investments_b: q.short_term_investments / 1e9,
  }));

  return (
    <ChartWrapper
      title="Cash & Liquid Assets — Quarterly"
      subtitle="Cash and short-term investments ($B)"
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="period" tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
          formatter={(v: unknown, name: unknown) => [`$${Number(v).toFixed(1)}B`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
        <Area type="monotone" dataKey="cash_b" name="Cash" stroke="#3b82f6" fill="url(#cashGrad)" />
        <Area type="monotone" dataKey="investments_b" name="Short-Term Investments" stroke="#10b981" fill="url(#invGrad)" />
      </AreaChart>
    </ChartWrapper>
  );
}
