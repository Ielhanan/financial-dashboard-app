# Watchlist Sidebar — Design Spec

**Date:** 2026-04-17  
**Status:** Approved

## Overview

Add a persistent stock watchlist sidebar to the financial dashboard. Users can save a custom list of tickers that survives page reloads (via `localStorage`). Clicking any ticker in the list immediately loads that ticker into the dashboard.

## Decisions Made

| Question | Decision |
|---|---|
| Sidebar placement | Fixed left sidebar — permanently visible, pushes main grid right |
| Clicking a ticker | Loads it into the dashboard (calls `setTicker()` from `tickerStore`) |
| Persistence layer | Zustand `persist` middleware writing to `localStorage` |

## Architecture

### 1. State — `frontend/src/store/watchlistStore.ts`

New Zustand store using the `persist` middleware.

```ts
interface WatchlistState {
  watchlist: string[];
  addStock: (symbol: string) => void;
  removeStock: (symbol: string) => void;
}
```

- **`localStorage` key:** `"watchlist"`
- **`addStock`:** uppercases input, trims whitespace, skips duplicates (case-insensitive check)
- **`removeStock`:** filters the symbol out by exact uppercase match
- **SSR safety:** use `skipHydration: true` and call `rehydrate()` inside a `useEffect` in the sidebar component to avoid Next.js hydration mismatch

### 2. Component — `frontend/src/components/layout/WatchlistSidebar.tsx`

A `"use client"` component. Fixed width: `w-52` (208px), sticky below the header (`sticky top-[57px] h-[calc(100vh-57px)]`) so it stays in view while the main content scrolls.

**Visual spec:**
- Background: `bg-slate-950` (darker than the main `bg-gray-900` to create contrast)
- Right border: `border-r border-gray-700/60` (matches the header border)
- Overflow: `overflow-y-auto` on the ticker list so long lists scroll without growing the sidebar

**Sub-sections (top to bottom):**

| Section | Contents |
|---|---|
| Header | "My Watchlist" title in emerald, `text-xs uppercase tracking-widest` |
| Input row | Text input + "+" button. Submits on Enter or button click. Auto-uppercases. |
| Ticker list | Scrollable. Each row: ticker name (monospace) + `×` delete button. Clickable row loads ticker. |
| Empty state | Shown when `watchlist.length === 0`: _"Your watchlist is empty. Add a ticker above."_ in muted text. |

**Active ticker highlight:** The row whose symbol matches `useTickerStore().ticker` gets `border border-emerald-500/50 text-emerald-400` treatment. All others use `text-gray-300`.

**Interaction:** Clicking a row calls `setTicker(symbol)` from `useTickerStore`. The `×` button calls `removeStock(symbol)` and stops event propagation so the row click doesn't also fire.

### 3. Layout — `frontend/src/components/layout/DashboardLayout.tsx`

Current structure:
```
<div>          ← full-page wrapper
  <header />   ← sticky top bar
  <main />     ← 12-col grid
</div>
```

New structure:
```
<div>             ← full-page wrapper
  <header />      ← sticky top bar (full width, unchanged)
  <div flex>      ← new flex row beneath the header
    <WatchlistSidebar />   ← fixed-width left column
    <main />               ← existing 12-col grid, flex-1
  </div>
</div>
```

The `<main>` tag keeps `grid grid-cols-1 xl:grid-cols-12 gap-5` and adds `flex-1 min-w-0` so it fills remaining space. The sidebar is `sticky top-[57px] h-[calc(100vh-57px)]` (offset by header height) so it stays in view while the main content scrolls.

## Data Flow

```
User types ticker in sidebar input
  → addStock(symbol) → watchlistStore (persisted to localStorage)

User clicks ticker row
  → setTicker(symbol) → tickerStore → all dashboard modules re-fetch

Page reload
  → Zustand persist middleware reads localStorage["watchlist"]
  → watchlist hydrated before first render (via useEffect rehydrate)
```

## Error & Edge Cases

| Case | Handling |
|---|---|
| Duplicate ticker added | `addStock` silently ignores if already present (case-insensitive check) |
| Empty input submitted | `addStock` ignores empty/whitespace-only strings |
| `localStorage` unavailable (SSR) | `persist` middleware only runs client-side; `skipHydration` prevents mismatch |
| Very long watchlist | Ticker list section is `overflow-y-auto` — scrollable within the sidebar |
| Ticker deleted while active | Ticker stays loaded in dashboard; `tickerStore` is independent of `watchlistStore` |

## Files Changed

| File | Change |
|---|---|
| `frontend/src/store/watchlistStore.ts` | **New** — Zustand persist store |
| `frontend/src/components/layout/WatchlistSidebar.tsx` | **New** — sidebar component |
| `frontend/src/components/layout/DashboardLayout.tsx` | **Modified** — add flex row, mount sidebar |

## Out of Scope

- Price display inside watchlist rows (data not fetched for list items)
- Drag-to-reorder
- Watchlist sharing / export
- Mobile/collapsed sidebar behaviour
