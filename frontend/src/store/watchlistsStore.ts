// frontend/src/store/watchlistsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WatchlistTab {
  id: string;
  name: string;
  tickers: string[];
}

interface WatchlistsState {
  lists: WatchlistTab[];
  activeId: string;
  addList: () => string;                              // returns the new list's id
  removeList: (id: string) => void;                  // no-op if lists.length === 1
  renameList: (id: string, name: string) => void;
  setActiveList: (id: string) => void;
  addTicker: (symbol: string) => void;               // uppercases, trims, dedupes; acts on active list
  removeTicker: (symbol: string) => void;            // acts on active list
}

export const useWatchlistsStore = create<WatchlistsState>()(
  persist(
    (set, get) => {
      const initial: WatchlistTab = {
        id: crypto.randomUUID(),
        name: "My Watchlist",
        tickers: [],
      };
      return {
        lists: [initial],
        activeId: initial.id,

        addList: () => {
          const { lists } = get();
          const newList: WatchlistTab = {
            id: crypto.randomUUID(),
            name: `Watchlist ${lists.length + 1}`,
            tickers: [],
          };
          set({ lists: [...lists, newList], activeId: newList.id });
          return newList.id;
        },

        removeList: (id) => {
          const { lists, activeId } = get();
          if (lists.length === 1) return;
          const next = lists.filter((l) => l.id !== id);
          set({
            lists: next,
            activeId: activeId === id ? next[0].id : activeId,
          });
        },

        renameList: (id, name) =>
          set((state) => ({
            lists: state.lists.map((l) => (l.id === id ? { ...l, name } : l)),
          })),

        setActiveList: (id) => set({ activeId: id }),

        addTicker: (symbol) => {
          const upper = symbol.trim().toUpperCase();
          if (!upper) return;
          const { lists, activeId } = get();
          const active = lists.find((l) => l.id === activeId);
          if (!active || active.tickers.includes(upper)) return;
          set({
            lists: lists.map((l) =>
              l.id === activeId
                ? { ...l, tickers: [...l.tickers, upper] }
                : l
            ),
          });
        },

        removeTicker: (symbol) => {
          const upper = symbol.trim().toUpperCase();
          const { lists, activeId } = get();
          set({
            lists: lists.map((l) =>
              l.id === activeId
                ? { ...l, tickers: l.tickers.filter((t) => t !== upper) }
                : l
            ),
          });
        },
      };
    },
    { name: "watchlists", skipHydration: true }
  )
);
