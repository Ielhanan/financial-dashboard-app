"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useEPSRevenue } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";
import { useChartColors } from "@/hooks/useChartColors";

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

function beatMissClass(actual: number | null, estimate: number | null): string {
  if (actual == null || estimate == null) return "";
  if (actual > estimate) return "text-green-400";
  if (actual < estimate) return "text-red-400";
  return "";
}

export function EPSRevenueChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useEPSRevenue(ticker);
  const c = useChartColors();

  const allPeriods = data?.quarterly_revenue ?? [];
  const allEPS = data?.quarterly_eps ?? [];

  // Chart: quarterly actual + projected only (no FY)
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

  // Separate annual rows (FY*) for their own table
  const annualTableData = allPeriods
    .filter((r) => r.period.startsWith("FY"))
    .map((rev, i) => {
      const eps = allEPS.filter((e) => e.period.startsWith("FY"))[i];
      return {
        period: rev.period,
        revenue_actual: rev.revenue_actual,
        revenue_yoy: rev.revenue_yoy_delta_pct,
        eps_actual: eps?.eps_actual ?? null,
        eps_yoy: eps?.eps_yoy_delta_pct ?? null,
      };
    });

  // Quarterly rows: past actuals + future estimates (no FY)
  const quarterlyTableData = allPeriods
    .filter((r) => !r.period.startsWith("FY"))
    .map((rev, i) => {
      const eps = allEPS.filter((e) => !e.period.startsWith("FY"))[i];
      const isFuture = rev.revenue_actual == null && rev.revenue_estimate != null;
      return {
        period: rev.period,
        revenue_actual: isFuture ? null : rev.revenue_actual,
        revenue_estimate: rev.revenue_estimate,
        revenue_yoy: rev.revenue_yoy_delta_pct,
        eps_actual: isFuture ? null : (eps?.eps_actual ?? null),
        eps_estimate: eps?.eps_estimate ?? null,
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
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
          <XAxis
            dataKey="period"
            tick={{ fill: c.tick, fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={52}
          />
          <YAxis yAxisId="left" tick={{ fill: c.tick, fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(0)}B`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: c.tick, fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
          <Tooltip
            contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, color: c.tooltipText }}
            labelStyle={{ color: c.tooltipText }}
            itemStyle={{ color: c.tooltipText }}
            cursor={false}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value);
              return name === "Revenue"
                ? [`$${v.toFixed(1)}B`, "Revenue"]
                : [`$${v.toFixed(2)}`, "EPS"];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: c.tick }} />
          <Bar yAxisId="left" dataKey="revenue_b" name="Revenue" radius={[3, 3, 0, 0]} activeBar={false}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isEstimate ? c.estimateBar : c.blue} opacity={entry.isEstimate ? 0.7 : 0.9} />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="eps"
            name="EPS"
            stroke={c.emerald}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isEstimate: boolean } };
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={payload.isEstimate ? "none" : c.emerald}
                  stroke={c.emerald}
                  strokeWidth={payload.isEstimate ? 1.5 : 0}
                  strokeDasharray={payload.isEstimate ? "3 2" : undefined}
                />
              );
            }}
            strokeWidth={2}
          />
        </ComposedChart>
      </ChartWrapper>

      <DataTable
        title="EPS & Revenue — Quarterly Detail"
        exportFilename={`${ticker}-eps-revenue-quarterly`}
        data={quarterlyTableData}
        columns={[
          { key: "period", label: "Period" },
          {
            key: "revenue_actual",
            label: "Revenue",
            render: (_val, row) => (
              <div>
                <span className={beatMissClass(row.revenue_actual as number | null, row.revenue_estimate as number | null)}>
                  {fmtRev(row.revenue_actual as number | null)}
                </span>
                {row.revenue_estimate != null && (
                  <div className="text-xs text-slate-500">
                    Est: {fmtRev(row.revenue_estimate as number | null)}
                  </div>
                )}
              </div>
            ),
          },
          { key: "revenue_yoy", label: "Rev YoY", format: (v) => fmtDelta(v as number | null | undefined) },
          {
            key: "eps_actual",
            label: "EPS",
            render: (_val, row) => (
              <div>
                <span className={beatMissClass(row.eps_actual as number | null, row.eps_estimate as number | null)}>
                  {fmtEPS(row.eps_actual as number | null)}
                </span>
                {row.eps_estimate != null && (
                  <div className="text-xs text-slate-500">
                    Est: {fmtEPS(row.eps_estimate as number | null)}
                  </div>
                )}
              </div>
            ),
          },
          { key: "eps_yoy", label: "EPS YoY", format: (v) => fmtDelta(v as number | null | undefined) },
        ]}
      />

      <DataTable
        title="EPS & Revenue — Annual History"
        exportFilename={`${ticker}-eps-revenue-annual`}
        data={annualTableData}
        columns={[
          { key: "period", label: "Fiscal Year" },
          { key: "revenue_actual", label: "Revenue", format: (v) => fmtRev(v as number | null) },
          { key: "revenue_yoy", label: "Rev YoY", format: (v) => fmtDelta(v as number | null | undefined) },
          { key: "eps_actual", label: "EPS", format: (v) => fmtEPS(v as number | null) },
          { key: "eps_yoy", label: "EPS YoY", format: (v) => fmtDelta(v as number | null | undefined) },
        ]}
      />
    </div>
  );
}
