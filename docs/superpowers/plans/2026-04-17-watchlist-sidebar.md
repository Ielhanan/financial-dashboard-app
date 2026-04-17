# Watchlist Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent left sidebar where users can save stock tickers that survive page reloads, and click any ticker to load it into the dashboard.

**Architecture:** A new Zustand store (`watchlistStore`) uses the `persist` middleware to read/write `localStorage["watchlist"]` automatically. A new `WatchlistSidebar` component renders the list and is mounted inside `DashboardLayout` in a flex row alongside the existing `<main>` grid. Clicking a ticker row calls `setTicker()` from the existing `tickerStore`, triggering a full dashboard refresh.

**Tech Stack:** Next.js 14 (App Router), Zustand v5 with `zustand/middleware` persist, Tailwind CSS, TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/store/watchlistStore.ts` | **Create** | Persisted state: `watchlist[]`, `addStock`, `removeStock` |
| `frontend/src/components/layout/WatchlistSidebar.tsx` | **Create** | Sidebar UI: header, input, ticker list, empty state |
| `frontend/src/components/layout/DashboardLayout.tsx` | **Modify** | Wrap body in flex row; mount `<WatchlistSidebar />` |

---

## Task 1: Create the Watchlist Store

**Files:**
- Create: `frontend/src/store/watchlistStore.ts`

- [ ] **Step 1: Create the store file**

```ts
// frontend/src/store/watchlistStore.ts
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
```

`skipHydration: true` prevents Zustand from reading `localStorage` during SSR (Next.js server renders the page before `localStorage` exists). The sidebar will call `rehydrate()` client-side in a `useEffect`.

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/watchlistStore.ts
git commit -m "feat: add watchlistStore with Zustand persist middleware"
```

---

## Task 2: Build the WatchlistSidebar Component

**Files:**
- Create: `frontend/src/components/layout/WatchlistSidebar.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// frontend/src/components/layout/WatchlistSidebar.tsx
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
    <aside className="sticky top-[57px] h-[calc(100vh-57px)] w-52 flex-shrink-0 flex flex-col bg-slate-950 border-r border-gray-700/60 overflow-hidden">

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
              <li
                key={symbol}
                onClick={() => setTicker(symbol)}
                className={`flex items-center justify-between rounded-md px-2.5 py-2 cursor-pointer transition-colors group
                  ${
                    isActive
                      ? "bg-emerald-900/30 border border-emerald-500/50"
                      : "bg-gray-800/60 border border-transparent hover:border-gray-600"
                  }`}
              >
                <span
                  className={`font-mono text-sm font-semibold ${
                    isActive
                      ? "text-emerald-400"
                      : "text-gray-300 group-hover:text-white"
                  }`}
                >
                  {symbol}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStock(symbol);
                  }}
                  className="text-gray-600 hover:text-red-400 transition-colors text-base leading-none ml-1"
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

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/WatchlistSidebar.tsx
git commit -m "feat: add WatchlistSidebar component"
```

---

## Task 3: Mount the Sidebar in DashboardLayout

**Files:**
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`

The current file (read it first to confirm it matches this before editing):

```tsx
// Current <main> line — line 60
<main className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
  {children}
</main>
```

- [ ] **Step 1: Add the WatchlistSidebar import**

At the top of `frontend/src/components/layout/DashboardLayout.tsx`, add the import after the existing `TickerSearch` import:

```tsx
import { WatchlistSidebar } from "./WatchlistSidebar";
```

- [ ] **Step 2: Replace the `<main>` tag with a flex body wrapping sidebar + main**

Find and replace this block (the closing `</div>` is the outer wrapper's close):

```tsx
      <main className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
        {children}
      </main>
    </div>
```

Replace with:

```tsx
      <div className="flex">
        <WatchlistSidebar />
        <main className="flex-1 min-w-0 p-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
          {children}
        </main>
      </div>
    </div>
```

`flex-1 min-w-0` makes `<main>` fill all remaining horizontal space. `min-w-0` prevents grid children from overflowing the flex container (a common CSS gotcha).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/DashboardLayout.tsx
git commit -m "feat: integrate WatchlistSidebar into DashboardLayout"
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

- [ ] **Step 2: Verify the sidebar renders**

Expected:
- A narrow dark sidebar (`~208px`) appears on the left.
- Main dashboard content fills the remaining width.
- Sidebar shows "My Watchlist" header and the empty state message.

- [ ] **Step 3: Add two tickers**

Type `TSLA` in the input and press Enter (or click `+`). Then type `MSFT` and add it.

Expected:
- Both tickers appear in the list as clickable rows.
- The input clears after each add.
- Adding `TSLA` a second time does nothing (duplicate guard).

- [ ] **Step 4: Click a ticker to load the dashboard**

Click `TSLA` in the sidebar.

Expected:
- The TSLA row gets an emerald highlight border.
- The ticker search bar in the header updates to show `TSLA`.
- All dashboard modules reload with TSLA data.

- [ ] **Step 5: Test persistence across reload**

Hard-refresh the page (`Ctrl+Shift+R` / `Cmd+Shift+R`).

Expected:
- Both `TSLA` and `MSFT` are still in the sidebar (hydrated from `localStorage`).
- Open DevTools → Application → Local Storage → `http://localhost:3000` → key `watchlist`. Confirm value is `{"state":{"watchlist":["TSLA","MSFT"]},"version":0}`.

- [ ] **Step 6: Test delete**

Click `×` next to `MSFT`.

Expected:
- `MSFT` disappears from the sidebar immediately.
- Hard-refresh: `MSFT` is gone. `TSLA` remains.
- `localStorage["watchlist"]` now shows only `TSLA`.

- [ ] **Step 7: Final commit**

```bash
git add -p   # confirm no stray changes
git commit -m "feat: persistent watchlist sidebar — complete"
```
