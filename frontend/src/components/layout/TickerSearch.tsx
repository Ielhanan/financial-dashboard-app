"use client";

import { useState, FormEvent } from "react";
import { useTickerStore } from "@/store/tickerStore";

export function TickerSearch() {
  const { ticker, setTicker } = useTickerStore();
  const [input, setInput] = useState(ticker);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed.length > 0) setTicker(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mr-12">
      <label htmlFor="ticker-input" className="text-sm text-gray-500 dark:text-gray-400 font-medium">
        Ticker
      </label>
      <input
        id="ticker-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        placeholder="AAPL"
        maxLength={10}
        className="w-28 px-3 py-1.5 rounded-lg
                   bg-gray-100 dark:bg-gray-800
                   border border-gray-300 dark:border-gray-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   text-sm font-mono
                   focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500
                   dark:focus:border-emerald-500 transition-colors uppercase"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-sm rounded-lg
                   bg-emerald-600 hover:bg-emerald-500
                   text-white font-medium transition-colors shadow-sm"
      >
        Load
      </button>
      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">{ticker}</span>
      </span>
    </form>
  );
}
