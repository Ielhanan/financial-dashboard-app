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
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{ticker}</span>
          {snapshot && (
            <span className="text-xl text-blue-600 dark:text-blue-300 font-mono font-medium">
              ${snapshot.price.toFixed(2)}
            </span>
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
          { label: "Market Cap", value: fmt(snapshot?.market_cap) },
          { label: "Enterprise Value", value: fmt(snapshot?.enterprise_value) },
          { label: "Total Debt", value: fmt(snapshot?.total_debt) },
          { label: "Cash & Equivalents", value: fmt(snapshot?.cash) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-700/30">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
