"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useEPSRevenue } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";

function fmtRev(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  return `$${(v / 1e9).toFixed(1)}B`;
}
function fmtEPS(v: number | null | undefined) {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}
function fmtDelta(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function EPSRevenueChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useEPSRevenue(ticker);

  const allPeriods = data?.quarterly_revenue ?? [];
  const allEPS = data?.quarterly_eps ?? [];

  // Chart: exclude FY annual rows (different revenue scale) — quarterly actual + projected only
  const chartData = allPeriods
    .filter((r) => !r.period.startsWith("FY"))
    .map((rev, i) => {
      const eps = allEPS.filter((e) => !e.period.startsWith("FY"))[i];
      const isEstimate = rev.revenue_actual == null && rev.revenue_estimate != null;
      return {
        period: isEstimate ? `${rev.period} (Est.)` : rev.period,
        rawPeriod: rev.period,
        revenue_b: rev.revenue_actual != null
          ? rev.revenue_actual / 1e9
          : rev.revenue_estimate != null
            ? rev.revenue_estimate / 1e9
            : null,
        eps: eps?.eps_actual ?? eps?.eps_estimate ?? null,
        isEstimate,
      };
    });

  // Table: all rows — FY annual + quarterly actuals + projected
  const tableData = allPeriods.map((rev, i) => {
    const eps = allEPS[i];
    const isFY = rev.period.startsWith("FY");
    const isEst = !isFY && rev.revenue_actual == null && rev.revenue_estimate != null;
    return {
      period: rev.period,
      type: isFY ? "Annual" : isEst ? "Estimate" : "Quarterly",
      revenue_actual: isFY ? rev.revenue_actual : (rev.revenue_actual ?? rev.revenue_estimate),
      revenue_yoy: rev.revenue_yoy_delta_pct,
      eps_actual: eps?.eps_actual ?? eps?.eps_estimate ?? null,
      eps_yoy: eps?.eps_yoy_delta_pct ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <ChartWrapper
        title="EPS & Revenue — Quarterly"
        subtitle="Bars = Revenue ($B) · Line = EPS · Gray = estimate"
        height={420}
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="period"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={52}
          />
          <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(0)}B`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value);
              return name === "revenue_b"
                ? [`$${v.toFixed(1)}B`, "Revenue"]
                : [`$${v.toFixed(2)}`, "EPS"];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar yAxisId="left" dataKey="revenue_b" name="Revenue" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isEstimate ? "#4b5563" : "#3b82f6"} opacity={entry.isEstimate ? 0.7 : 0.85} />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="eps"
            name="EPS"
            stroke="#10b981"
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isEstimate: boolean } };
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={payload.isEstimate ? "none" : "#10b981"}
                  stroke="#10b981"
                  strokeWidth={payload.isEstimate ? 1.5 : 0}
                  strokeDasharray={payload.isEstimate ? "3 2" : undefined}
                />
              );
            }}
            strokeWidth={2}
            strokeDasharray={undefined}
          />
        </ComposedChart>
      </ChartWrapper>

      <DataTable
        title="EPS & Revenue Detail"
        exportFilename={`${ticker}-eps-revenue`}
        data={tableData}
        columns={[
          { key: "period", label: "Period" },
          { key: "type", label: "Type" },
          { key: "revenue_actual", label: "Revenue", format: (v) => fmtRev(v as number | null) },
          { key: "revenue_yoy", label: "Rev YoY", format: (v) => fmtDelta(v as number | null | undefined) },
          { key: "eps_actual", label: "EPS", format: (v) => fmtEPS(v as number | null) },
          { key: "eps_yoy", label: "EPS YoY", format: (v) => fmtDelta(v as number | null | undefined) },
        ]}
      />
    </div>
  );
}
