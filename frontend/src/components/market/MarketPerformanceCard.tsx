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
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-2xl font-bold font-mono text-white">{ticker}</span>
          {snapshot && (
            <span className="ml-3 text-xl text-blue-300 font-mono">
              ${snapshot.price.toFixed(2)}
            </span>
          )}
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            connected
              ? "bg-green-900 text-green-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          {connected ? "LIVE" : "Connecting…"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Market Cap</p>
          <p className="text-lg font-semibold text-white">
            {fmt(snapshot?.market_cap)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Enterprise Value</p>
          <p className="text-lg font-semibold text-white">
            {fmt(snapshot?.enterprise_value)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total Debt</p>
          <p className="text-base font-medium text-gray-200">
            {fmt(snapshot?.total_debt)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Cash & Equivalents</p>
          <p className="text-base font-medium text-gray-200">
            {fmt(snapshot?.cash)}
          </p>
        </div>
      </div>
    </div>
  );
}
