import { create } from "zustand";

interface TickerState {
  ticker: string;
  setTicker: (ticker: string) => void;
}

export const useTickerStore = create<TickerState>((set) => ({
  ticker: "AAPL",
  setTicker: (ticker) => set({ ticker: ticker.toUpperCase().trim() }),
}));
