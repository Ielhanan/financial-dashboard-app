"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useWatchlistStore } from "@/store/watchlistStore";
import { useTickerStore } from "@/store/tickerStore";

export function WatchlistSidebar() {
  const { watchlist, addStock, removeStock } = useWatchlistStore();
  const { ticker, setTicker } = useTickerStore();
  const [input, setInput] = useState("");

  // Hydrate from localStorage on first client render.
  // skipHydration: true in the store means this is the only place it reads localStorage.
  useEffect(() => {
    useWatchlistStore.persist.rehydrate();
  }, []);

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    addStock(trimmed);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAdd();
  }

  return (
    <aside className="sticky top-[var(--header-h)] h-[calc(100vh-var(--header-h))] w-52 flex-shrink-0 flex flex-col bg-slate-950 border-r border-gray-700/60 overflow-hidden">

      {/* Section: Title */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-700/60">
        <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
          My Watchlist
        </h2>
      </div>

      {/* Section: Add input */}
      <div className="px-3 pt-3 pb-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="e.g. MSFT"
          maxLength={10}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md
                     bg-gray-800 border border-gray-600
                     text-white placeholder-gray-500
                     text-xs font-mono uppercase
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500
                     transition-colors"
        />
        <button
          onClick={handleAdd}
          aria-label="Add ticker to watchlist"
          className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
        >
          +
        </button>
      </div>

      {/* Section: Ticker list */}
      <ul className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
        {watchlist.length === 0 ? (
          <li className="text-gray-500 text-xs text-center pt-6 leading-relaxed">
            Your watchlist is empty.<br />Add a ticker above.
          </li>
        ) : (
          watchlist.map((symbol) => {
            const isActive = symbol === ticker;
            return (
              <li key={symbol} className="flex items-center gap-1.5">
                <button
                  onClick={() => setTicker(symbol)}
                  className={`flex-1 text-left rounded-md px-2.5 py-2 transition-colors group
                    ${isActive
                      ? "bg-emerald-900/30 border border-emerald-500/50"
                      : "bg-gray-800/60 border border-transparent hover:border-gray-600"}`}
                >
                  <span className={`font-mono text-sm font-semibold ${
                    isActive ? "text-emerald-400" : "text-gray-300 group-hover:text-white"
                  }`}>
                    {symbol}
                  </span>
                </button>
                <button
                  onClick={() => removeStock(symbol)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-base leading-none flex-shrink-0 px-1"
                  aria-label={`Remove ${symbol}`}
                >
                  ×
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
