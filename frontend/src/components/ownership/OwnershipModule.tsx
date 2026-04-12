"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useOwnership, useDividends } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";

const COLORS = ["#3b82f6", "#10b981", "#6b7280"];

export function OwnershipModule() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data: ownership, isLoading: ownerLoading, error: ownerError } = useOwnership(ticker);
  const { data: dividends, isLoading: divLoading, error: divError } = useDividends(ticker);

  const pieData = [
    { name: "Insider", value: ownership?.insider_pct ?? 0 },
    { name: "Institutional", value: ownership?.institutional_pct ?? 0 },
    { name: "Other", value: Math.max(0, 100 - (ownership?.insider_pct ?? 0) - (ownership?.institutional_pct ?? 0)) },
  ];

  const divChartData = (dividends?.dividends ?? []).slice(-20).map((d) => ({
    date: d.date.slice(0, 7),
    amount: d.amount,
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartWrapper
        title="Ownership Structure"
        subtitle="Insider vs Institutional vs Other"
        height={240}
        isLoading={ownerLoading}
        error={ownerError ? String(ownerError) : null}
      >
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={90}
            dataKey="value"
            label={({ name, value }: { name?: string; value?: number }) => `${name ?? ""}: ${(value ?? 0).toFixed(1)}%`}
            labelLine={false}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(2)}%`} />
        </PieChart>
      </ChartWrapper>

      <DataTable
        title="Top Institutional Holders"
        exportFilename={`${ticker}-ownership`}
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

      <ChartWrapper
        title="Dividend Payment History"
        subtitle="Per-share dividend amount over time"
        isLoading={divLoading}
        error={divError ? String(divError) : null}
      >
        <BarChart data={divChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 9 }} interval={3} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(v: unknown) => [`$${Number(v).toFixed(4)}`, "Dividend"]}
          />
          <Bar dataKey="amount" name="Dividend/Share" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartWrapper>

      <DataTable
        title="Dividend Details"
        exportFilename={`${ticker}-dividends`}
        data={(dividends?.dividends ?? []).slice(-20).reverse().map((d) => ({
          date: d.date,
          amount: d.amount,
          yield_pct: d.yield_pct,
        }))}
        columns={[
          { key: "date", label: "Date" },
          { key: "amount", label: "Amount/Share", format: (v) => `$${(v as number).toFixed(4)}` },
          { key: "yield_pct", label: "Annual Yield", format: (v) => v != null ? `${(v as number).toFixed(2)}%` : "—" },
        ]}
      />
    </div>
  );
}
