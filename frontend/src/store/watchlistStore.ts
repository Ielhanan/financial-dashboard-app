import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WatchlistState {
  watchlist: string[];
  addStock: (symbol: string) => void;
  removeStock: (symbol: string) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      watchlist: [],
      addStock: (symbol) => {
        const upper = symbol.trim().toUpperCase();
        if (!upper) return;
        if (get().watchlist.includes(upper)) return;
        set((state) => ({ watchlist: [...state.watchlist, upper] }));
      },
      removeStock: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.filter((s) => s !== symbol),
        })),
    }),
    { name: "watchlist", skipHydration: true }
  )
);
