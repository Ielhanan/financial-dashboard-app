"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useEPSRevenue } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";

function fmtRev(v: number | null) {
  if (v == null) return "—";
  return `$${(v / 1e9).toFixed(1)}B`;
}
function fmtEPS(v: number | null) {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}
function fmtDelta(v: number | null) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function EPSRevenueChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useEPSRevenue(ticker);

  const chartData = (data?.quarterly_revenue ?? []).map((rev, i) => {
    const eps = data?.quarterly_eps[i];
    return {
      period: rev.period,
      revenue_b: rev.revenue_actual != null ? rev.revenue_actual / 1e9 : null,
      eps: eps?.eps_actual ?? null,
    };
  });

  const tableData = (data?.quarterly_revenue ?? []).map((rev, i) => {
    const eps = data?.quarterly_eps[i];
    return {
      period: rev.period,
      revenue_actual: rev.revenue_actual,
      revenue_yoy: rev.revenue_yoy_delta_pct,
      eps_actual: eps?.eps_actual ?? null,
      eps_yoy: eps?.eps_yoy_delta_pct ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <ChartWrapper
        title="EPS & Revenue — Quarterly"
        subtitle="Last 5 years | Bars = Revenue ($B), Line = EPS ($)"
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="period" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value);
              return name === "revenue_b" ? [`$${v.toFixed(1)}B`, "Revenue"] : [`$${v.toFixed(2)}`, "EPS"];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar yAxisId="left" dataKey="revenue_b" name="Revenue" fill="#3b82f6" opacity={0.8} />
          <Line yAxisId="right" type="monotone" dataKey="eps" name="EPS" stroke="#10b981" dot={{ r: 2 }} strokeWidth={2} />
        </ComposedChart>
      </ChartWrapper>

      <DataTable
        title="EPS & Revenue Detail"
        exportFilename={`${ticker}-eps-revenue`}
        data={tableData}
        columns={[
          { key: "period", label: "Period" },
          { key: "revenue_actual", label: "Revenue", format: (v) => fmtRev(v as number | null) },
          { key: "revenue_yoy", label: "Rev YoY", format: (v) => fmtDelta(v as number | null) },
          { key: "eps_actual", label: "EPS", format: (v) => fmtEPS(v as number | null) },
          { key: "eps_yoy", label: "EPS YoY", format: (v) => fmtDelta(v as number | null) },
        ]}
      />
    </div>
  );
}
