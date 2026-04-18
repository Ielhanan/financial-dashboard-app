# Multi-Watchlist Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single flat watchlist with multiple named watchlists selectable via TradingView-style tabs, with inline rename on double-click and delete confirmation.

**Architecture:** A new `watchlistsStore.ts` replaces the old `watchlistStore.ts` entirely — the data shape changes from `string[]` to `{ lists: WatchlistTab[], activeId: string }` persisted under the new localStorage key `"watchlists"`. `WatchlistSidebar.tsx` is rewritten to add a tab bar at the top (with inline rename, delete confirmation banner) while keeping the ticker input and list below unchanged in appearance.

**Tech Stack:** Next.js 14 App Router, Zustand v5 with `zustand/middleware` persist, Tailwind CSS, TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/store/watchlistsStore.ts` | **Create** | Multi-list state: `lists[]`, `activeId`, all CRUD actions |
| `frontend/src/store/watchlistStore.ts` | **Delete** | Old single-list store — no longer needed |
| `frontend/src/components/layout/WatchlistSidebar.tsx` | **Rewrite** | Tab bar + inline rename + delete banner + ticker list |

---

## Task 1: Create `watchlistsStore.ts`

**Files:**
- Create: `frontend/src/store/watchlistsStore.ts`

- [ ] **Step 1: Create the store file**

```ts
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
          const { lists, activeId } = get();
          set({
            lists: lists.map((l) =>
              l.id === activeId
                ? { ...l, tickers: l.tickers.filter((t) => t !== symbol) }
                : l
            ),
          });
        },
      };
    },
    { name: "watchlists", skipHydration: true }
  )
);
```

- [ ] **Step 2: Verify TypeScript compiles clean**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/watchlistsStore.ts
git commit -m "feat: add watchlistsStore with multi-list Zustand persist"
```

---

## Task 2: Rewrite `WatchlistSidebar.tsx`

**Files:**
- Modify: `frontend/src/components/layout/WatchlistSidebar.tsx` (full rewrite)

- [ ] **Step 1: Replace the entire file with this implementation**

```tsx
// frontend/src/components/layout/WatchlistSidebar.tsx
"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useWatchlistsStore } from "@/store/watchlistsStore";
import { useTickerStore } from "@/store/tickerStore";

export function WatchlistSidebar() {
  const {
    lists, activeId,
    addList, removeList, renameList, setActiveList,
    addTicker, removeTicker,
  } = useWatchlistsStore();
  const { ticker, setTicker } = useTickerStore();

  const [input, setInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hydrate localStorage on first client render (skipHydration: true in store)
  useEffect(() => {
    useWatchlistsStore.persist.rehydrate();
  }, []);

  const activeList = lists.find((l) => l.id === activeId) ?? lists[0];
  const deletingList = lists.find((l) => l.id === deletingId);

  // ── Ticker handlers ────────────────────────────────────────────────────────

  function handleAddTicker() {
    const trimmed = input.trim();
    if (!trimmed) return;
    addTicker(trimmed);
    setInput("");
  }

  function handleTickerKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAddTicker();
  }

  // ── List (tab) handlers ────────────────────────────────────────────────────

  function handleAddList() {
    const newName = `Watchlist ${lists.length + 1}`;
    const newId = addList();           // addList returns the new id and sets it active
    setRenamingId(newId);
    setRenameValue(newName);
  }

  function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    const current = lists.find((l) => l.id === renamingId);
    renameList(renamingId, trimmed || current?.name || "Watchlist");
    setRenamingId(null);
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setRenamingId(null);
  }

  function handleDeleteConfirm() {
    if (!deletingId) return;
    removeList(deletingId);
    setDeletingId(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className="sticky top-[var(--header-h)] h-[calc(100vh-var(--header-h))] w-52 flex-shrink-0 flex flex-col bg-slate-950 border-r border-gray-700/60 overflow-hidden">

      {/* ── Tab bar ── */}
      <div
        className="flex items-stretch border-b border-gray-700/60 overflow-x-auto flex-shrink-0"
        style={{ scrollbarWidth: "none" }}
      >
        {lists.map((list) => {
          const isActive = list.id === activeId;
          const isRenaming = renamingId === list.id;
          return (
            <div
              key={list.id}
              onClick={() => { if (!isRenaming) setActiveList(list.id); }}
              onDoubleClick={() => {
                setRenamingId(list.id);
                setRenameValue(list.name);
              }}
              className={`flex items-center gap-1 px-2.5 py-2 cursor-pointer flex-shrink-0 border-b-2 transition-colors select-none
                ${isActive
                  ? "border-emerald-500 bg-gray-800/60"
                  : "border-transparent hover:bg-gray-800/30"}`}
            >
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 bg-gray-900 border border-emerald-500 rounded px-1 py-0.5 text-xs text-emerald-400 font-bold outline-none"
                />
              ) : (
                <span className={`text-xs font-semibold truncate max-w-[72px] ${
                  isActive ? "text-emerald-400" : "text-gray-500 group-hover:text-gray-300"
                }`}>
                  {list.name}
                </span>
              )}
              {lists.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletingId(list.id); }}
                  aria-label={`Delete ${list.name}`}
                  className="text-gray-600 hover:text-red-400 transition-colors text-sm leading-none flex-shrink-0"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {/* Add list button */}
        <button
          onClick={handleAddList}
          aria-label="Add watchlist"
          className="ml-auto px-2.5 py-2 text-gray-500 hover:text-white transition-colors text-sm leading-none flex-shrink-0 border-l border-gray-700/60 border-b-2 border-b-transparent"
        >
          +
        </button>
      </div>

      {/* ── Delete confirmation banner ── */}
      {deletingId && deletingList && (
        <div className="mx-3 mt-3 p-3 bg-gray-900 border border-red-900 rounded-lg flex flex-col gap-2 flex-shrink-0">
          <p className="text-red-300 text-xs font-bold">Delete "{deletingList.name}"?</p>
          <p className="text-gray-500 text-xs leading-relaxed">
            This will remove{" "}
            <span className="text-gray-400 font-semibold">
              {deletingList.tickers.length} ticker{deletingList.tickers.length !== 1 ? "s" : ""}
            </span>
            . This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteConfirm}
              className="flex-1 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-300 text-xs font-bold transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeletingId(null)}
              className="flex-1 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Add ticker input ── */}
      <div className="px-3 pt-3 pb-2 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleTickerKeyDown}
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
          onClick={handleAddTicker}
          aria-label="Add ticker to watchlist"
          className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
        >
          +
        </button>
      </div>

      {/* ── Ticker list ── */}
      <ul className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
        {!activeList || activeList.tickers.length === 0 ? (
          <li className="text-gray-500 text-xs text-center pt-6 leading-relaxed">
            This watchlist is empty.<br />Add a ticker above.
          </li>
        ) : (
          activeList.tickers.map((symbol) => {
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
                  onClick={() => removeTicker(symbol)}
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
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/WatchlistSidebar.tsx
git commit -m "feat: rewrite WatchlistSidebar with multi-watchlist tab bar"
```

---

## Task 3: Delete `watchlistStore.ts`

**Files:**
- Delete: `frontend/src/store/watchlistStore.ts`

- [ ] **Step 1: Confirm no other file imports from the old store**

Run from repo root:
```bash
grep -r "watchlistStore" frontend/src --include="*.ts" --include="*.tsx"
```
Expected: no matches (the rewrite in Task 2 already removed the only import).

- [ ] **Step 2: Delete the file**

```bash
git rm frontend/src/store/watchlistStore.ts
```

- [ ] **Step 3: Verify TypeScript still compiles clean**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove watchlistStore — replaced by watchlistsStore"
```

---

## Task 4: Validate in the Browser

**Files:** none — manual QA only

- [ ] **Step 1: Start the dev server**

From `frontend/`:
```bash
npm run dev
```
Open `http://localhost:3000`.

- [ ] **Step 2: Verify tab bar renders**

Expected:
- A single tab labelled "My Watchlist" appears at the top of the sidebar with an emerald underline.
- A `+` button sits at the far right of the tab bar.
- The ticker input and empty state message appear below.

- [ ] **Step 3: Add a second watchlist**

Click `+`. Expected:
- A new tab appears labelled "Watchlist 2" and is immediately in inline rename mode (input focused, text pre-filled).
- Type "Growth" and press Enter. The tab now reads "Growth".
- "Growth" tab is active (emerald underline).

- [ ] **Step 4: Add tickers to each list**

With "Growth" active, add `NVDA` and `TSLA`.  
Click the "My Watchlist" tab. Add `AAPL` and `MSFT`.  
Expected:
- Switching tabs shows different ticker lists.
- Tickers added to "Growth" do not appear under "My Watchlist" and vice versa.

- [ ] **Step 5: Click to load ticker**

Click `AAPL` in the sidebar. Expected:
- AAPL row gets emerald highlight.
- Header search bar updates to `AAPL`.
- Dashboard reloads with AAPL data.

- [ ] **Step 6: Rename a tab**

Double-click the "My Watchlist" tab. Expected:
- Name becomes an editable input pre-filled with "My Watchlist".
- Type "Blue Chip" and press Enter. Tab now reads "Blue Chip".

- [ ] **Step 7: Delete a watchlist with confirmation**

Click `×` on the "Growth" tab. Expected:
- A red confirmation banner appears below the tab bar reading `Delete "Growth"?` with the ticker count.
- Click "Cancel" — banner disappears, list is unchanged.
- Click `×` again, then click "Delete" — "Growth" tab and its tickers are permanently removed.
- "Blue Chip" (or whichever list remains) becomes active.

- [ ] **Step 8: Verify last-list guard**

With only one list remaining, verify the `×` button on that tab is **not visible**.

- [ ] **Step 9: Test persistence across reload**

Hard-refresh (`Ctrl+Shift+R`). Expected:
- All remaining lists and their tickers are restored from `localStorage["watchlists"]`.
- Open DevTools → Application → Local Storage → `http://localhost:3000` → key `watchlists`. Confirm it contains `lists` array with correct names and tickers.
- Old key `watchlist` should not exist (or if it does, it is ignored).

- [ ] **Step 10: Final commit**

```bash
git status   # confirm no stray changes
```
No uncommitted changes expected — all work was committed in Tasks 1–3.
