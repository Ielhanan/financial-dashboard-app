"use client";

import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useOwnership, useDividends } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";
import { useChartColors } from "@/hooks/useChartColors";
import { Lock } from "lucide-react";

export function OwnershipModule() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data: ownership, isLoading: ownerLoading, error: ownerError } = useOwnership(ticker);
  const { data: dividends, isLoading: divLoading, error: divError } = useDividends(ticker);
  const c = useChartColors();

  const PIE_COLORS = [c.blue, c.emerald, c.gray];

  const pieData = [
    { name: "Insider", value: ownership?.insider_pct ?? 0 },
    { name: "Institutional", value: ownership?.institutional_pct ?? 0 },
    { name: "Other", value: Math.max(0, 100 - (ownership?.insider_pct ?? 0) - (ownership?.institutional_pct ?? 0)) },
  ];

  const divChartData = (dividends?.dividends ?? [])
    .slice(0, 20)   // newest-first API: first 20 = most recent
    .reverse()      // flip to oldest→newest for left-to-right axis
    .map((d) => ({
      date: d.date.slice(0, 7),
      amount: d.amount,
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartWrapper
        title="Ownership Structure"
        subtitle="Insider vs Institutional vs Other"
        height={260}
        isLoading={ownerLoading}
        error={ownerError ? String(ownerError) : null}
      >
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={95}
            dataKey="value"
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, color: c.tooltipText }}
            labelStyle={{ color: c.tooltipText }}
            itemStyle={{ color: c.tooltipText }}
            formatter={(v: unknown) => `${Number(v).toFixed(2)}%`}
          />
        </PieChart>
      </ChartWrapper>

      <DataTable
        title="Top Institutional Holders"
        exportFilename={`${ticker}-ownership`}
        emptyMessage="Institutional holder data is not available on the free FMP plan."
        emptyState={
          <div className="flex flex-col items-center justify-center py-10 px-6 gap-3">
            <Lock className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-xs leading-relaxed">
              Institutional holder data is not available on the free FMP plan.
            </p>
            <button
              disabled
              className="mt-1 px-3 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700
                         text-gray-400 dark:text-gray-600 cursor-not-allowed select-none"
            >
              Upgrade Plan
            </button>
          </div>
        }
        data={(ownership?.top_holders ?? []).map((h) => ({
          holder: h.holder,
          pct_out: h.pct_out,
          shares_m: h.shares / 1e6,
        }))}
        columns={[
          { key: "holder", label: "Holder" },
          { key: "pct_out", label: "% Outstanding", format: (v) => `${(v as number).toFixed(2)}%` },
          { key: "shares_m", label: "Shares (M)", format: (v) => `${(v as number).toFixed(1)}M` },
        ]}
      />

      <div className="lg:col-span-2 flex items-stretch gap-4">
        <div className="w-4/5 flex flex-col min-h-0">
          <ChartWrapper
            title="Dividend Payment History"
            subtitle="Per-share dividend amount over time"
            fillHeight
            isLoading={divLoading}
            error={divError ? String(divError) : null}
          >
            <AreaChart data={divChartData}>
              <defs>
                <linearGradient id="divGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.emerald} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={c.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
              <XAxis dataKey="date" tick={{ fill: c.tick, fontSize: 9 }} interval={3} />
              <YAxis tick={{ fill: c.tick, fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, color: c.tooltipText }}
                labelStyle={{ color: c.tooltipText }}
                itemStyle={{ color: c.tooltipText }}
                cursor={{ stroke: c.grid }}
                allowEscapeViewBox={{ x: true, y: false }}
                formatter={(v: unknown) => [`$${Number(v).toFixed(4)}`, "Dividend"]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                name="Dividend/Share"
                stroke={c.emerald}
                strokeWidth={2}
                fill="url(#divGradient)"
                dot={false}
                activeDot={{ r: 4, fill: c.emerald }}
              />
            </AreaChart>
          </ChartWrapper>
        </div>
        <div className="w-1/5 flex flex-col min-h-0">
          <DataTable
            title="Dividend Details"
            exportFilename={`${ticker}-dividends`}
            fillHeight
            data={(dividends?.dividends ?? []).slice(-20).reverse().map((d) => ({
              date: d.date,
              amount: d.amount,
            }))}
            columns={[
              { key: "date", label: "Date" },
              { key: "amount", label: "Amount/Share", format: (v) => `$${(v as number).toFixed(4)}` },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
