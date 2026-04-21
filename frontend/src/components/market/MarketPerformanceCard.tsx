"use client";

import { useTickerStore } from "@/store/tickerStore";
import { useMarketSocket } from "@/hooks/useMarketSocket";

function fmt(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

export function MarketPerformanceCard() {
  const ticker = useTickerStore((s) => s.ticker);
  const { snapshot, connected } = useMarketSocket(ticker);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{ticker}</span>
          {snapshot && (
            <>
              <span className="text-xl text-blue-600 dark:text-blue-300 font-mono font-medium">
                ${snapshot.price.toFixed(2)}
              </span>
              {snapshot.change != null && (
                <span className={`text-sm font-mono ${snapshot.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {snapshot.change >= 0 ? "+" : ""}
                  {snapshot.change.toFixed(2)} ({(snapshot.change_pct ?? 0).toFixed(2)}%)
                </span>
              )}
            </>
          )}
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold tracking-wide ${
            connected
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
          }`}
        >
          {connected ? "LIVE" : "Connecting…"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Market Cap",        value: fmt(snapshot?.market_cap),        yoy: snapshot?.market_cap_yoy ?? null },
          { label: "Enterprise Value",  value: fmt(snapshot?.enterprise_value),  yoy: null },
          { label: "Total Debt",        value: fmt(snapshot?.total_debt),        yoy: snapshot?.total_debt_yoy ?? null },
          { label: "Cash & Equivalents",value: fmt(snapshot?.cash),              yoy: null },
        ].map(({ label, value, yoy }) => (
          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-700/30">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{value}</p>
            {yoy != null && (
              <p className={`text-xs mt-0.5 ${yoy >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
                {yoy >= 0 ? "↑" : "↓"} {Math.abs(yoy).toFixed(1)}% YoY
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
