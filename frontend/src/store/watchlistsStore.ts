// frontend/src/store/watchlistsStore.ts
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface WatchlistTab {
  id: string;
  name: string;
  tickers: string[];
}

interface WatchlistsState {
  lists: WatchlistTab[];
  activeId: string;

  // ── async hydration ────────────────────────────────────────────────────────
  loadFromSupabase: (userId: string) => Promise<void>;

  // ── session cleanup ────────────────────────────────────────────────────────
  reset: () => void;

  // ── list mutations ─────────────────────────────────────────────────────────
  addList: (userId: string) => string;          // returns the new list's id
  removeList: (id: string) => void;             // no-op if lists.length === 1
  renameList: (id: string, name: string) => void;
  setActiveList: (id: string) => void;

  // ── ticker mutations ───────────────────────────────────────────────────────
  addTicker: (symbol: string, watchlistId?: string) => void;    // uppercases, trims, dedupes; defaults to active list
  removeTicker: (symbol: string, watchlistId?: string) => void; // defaults to active list
}

const EMPTY_STATE = {
  lists: [] as WatchlistTab[],
  activeId: "",
};

export const useWatchlistsStore = create<WatchlistsState>()((set, get) => ({
  ...EMPTY_STATE,

  // ── hydration ──────────────────────────────────────────────────────────────
  loadFromSupabase: async (userId: string) => {
    const { data: watchlists, error: wlError } = await supabase
      .from("watchlists")
      .select("id, name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (wlError || !watchlists) return;

    const { data: allItems, error: itemsError } = await supabase
      .from("watchlist_items")
      .select("watchlist_id, ticker, position")
      .in(
        "watchlist_id",
        watchlists.map((w) => w.id)
      )
      .order("position", { ascending: true });

    if (itemsError) return;

    const itemsByList = (allItems ?? []).reduce<Record<string, string[]>>(
      (acc, item) => {
        if (!acc[item.watchlist_id]) acc[item.watchlist_id] = [];
        acc[item.watchlist_id].push(item.ticker);
        return acc;
      },
      {}
    );

    const lists: WatchlistTab[] = watchlists.map((w) => ({
      id: w.id,
      name: w.name,
      tickers: itemsByList[w.id] ?? [],
    }));

    set({
      lists,
      activeId: lists.length > 0 ? lists[0].id : "",
    });
  },

  // ── session cleanup ────────────────────────────────────────────────────────
  reset: () => set({ ...EMPTY_STATE }),

  // ── list mutations ─────────────────────────────────────────────────────────
  addList: (userId: string) => {
    const { lists } = get();
    const newList: WatchlistTab = {
      id: crypto.randomUUID(),
      name: `Watchlist ${lists.length + 1}`,
      tickers: [],
    };

    // optimistic update
    set({ lists: [...lists, newList], activeId: newList.id });

    // background sync
    supabase
      .from("watchlists")
      .insert({ id: newList.id, user_id: userId, name: newList.name })
      .then(({ error }) => {
        if (error) console.error("[watchlists] addList sync failed:", error);
      });

    return newList.id;
  },

  removeList: (id: string) => {
    const { lists, activeId } = get();
    if (lists.length === 1) return;

    const next = lists.filter((l) => l.id !== id);

    // optimistic update
    set({
      lists: next,
      activeId: activeId === id ? next[0].id : activeId,
    });

    // background sync (cascade deletes watchlist_items via FK)
    supabase
      .from("watchlists")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[watchlists] removeList sync failed:", error);
      });
  },

  renameList: (id: string, name: string) => {
    // optimistic update
    set((state) => ({
      lists: state.lists.map((l) => (l.id === id ? { ...l, name } : l)),
    }));

    // background sync
    supabase
      .from("watchlists")
      .update({ name })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[watchlists] renameList sync failed:", error);
      });
  },

  setActiveList: (id: string) => set({ activeId: id }),

  // ── ticker mutations ───────────────────────────────────────────────────────
  addTicker: (symbol: string, watchlistId?: string) => {
    const upper = symbol.trim().toUpperCase();
    if (!upper) return;

    const { lists, activeId } = get();
    const targetId = watchlistId ?? activeId;
    const target = lists.find((l) => l.id === targetId);
    if (!target || target.tickers.includes(upper)) return;

    const position = target.tickers.length; // 0-based position before insert

    // optimistic update
    set({
      lists: lists.map((l) =>
        l.id === targetId ? { ...l, tickers: [...l.tickers, upper] } : l
      ),
    });

    // background sync
    supabase
      .from("watchlist_items")
      .insert({ watchlist_id: targetId, ticker: upper, position })
      .then(({ error }) => {
        if (error) console.error("[watchlists] addTicker sync failed:", error);
      });
  },

  removeTicker: (symbol: string, watchlistId?: string) => {
    const upper = symbol.trim().toUpperCase();
    const { lists, activeId } = get();
    const targetId = watchlistId ?? activeId;

    // optimistic update
    set({
      lists: lists.map((l) =>
        l.id === targetId
          ? { ...l, tickers: l.tickers.filter((t) => t !== upper) }
          : l
      ),
    });

    // background sync
    supabase
      .from("watchlist_items")
      .delete()
      .eq("watchlist_id", targetId)
      .eq("ticker", upper)
      .then(({ error }) => {
        if (error)
          console.error("[watchlists] removeTicker sync failed:", error);
      });
  },
}));
