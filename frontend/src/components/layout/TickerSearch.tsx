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
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label htmlFor="ticker-input" className="text-sm text-gray-400 font-medium">
        Ticker
      </label>
      <input
        id="ticker-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        placeholder="AAPL"
        maxLength={10}
        className="w-28 px-3 py-1.5 rounded bg-gray-800 border border-gray-600
                   text-white placeholder-gray-500 text-sm font-mono
                   focus:outline-none focus:border-blue-500 uppercase"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500
                   text-white font-medium transition-colors"
      >
        Load
      </button>
      <span className="text-xs text-gray-500 ml-2">
        Active: <span className="text-blue-400 font-mono">{ticker}</span>
      </span>
    </form>
  );
}
