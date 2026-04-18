"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useCash } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { useChartColors } from "@/hooks/useChartColors";

export function CashChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useCash(ticker);
  const c = useChartColors();

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
            <stop offset="5%" stopColor={c.blue} stopOpacity={0.35} />
            <stop offset="95%" stopColor={c.blue} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c.emerald} stopOpacity={0.35} />
            <stop offset="95%" stopColor={c.emerald} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis dataKey="period" tick={{ fill: c.tick, fontSize: 10 }} />
        <YAxis tick={{ fill: c.tick, fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, color: c.tooltipText }}
          labelStyle={{ color: c.tooltipText }}
          itemStyle={{ color: c.tooltipText }}
          formatter={(v: unknown, name: unknown) => [`$${Number(v).toFixed(1)}B`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: c.tick }} />
        <Area type="monotone" dataKey="cash_b" name="Cash" stroke={c.blue} fill="url(#cashGrad)" strokeWidth={2} />
        <Area type="monotone" dataKey="investments_b" name="Short-Term Investments" stroke={c.emerald} fill="url(#invGrad)" strokeWidth={2} />
      </AreaChart>
    </ChartWrapper>
  );
}
