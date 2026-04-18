# Multi-Watchlist Sidebar — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Overview

Upgrade the existing single-list watchlist sidebar to support multiple named watchlists (like TradingView). Users can create, rename, and delete watchlists to categorize their stocks. Each watchlist has its own ticker list. State persists to `localStorage`.

## Decisions Made

| Question | Decision |
|---|---|
| Navigation style | Tabs at the top of the sidebar (TradingView style) |
| Rename | Double-click a tab → inline text input → Enter or blur to commit |
| Delete | × on tab → inline confirmation banner with ticker count → "Delete" or "Cancel" |
| State approach | Replace `watchlistStore` with new `watchlistsStore` (Option 1) |
| localStorage key | `"watchlists"` (old `"watchlist"` key silently abandoned) |

## Data Model

```ts
interface WatchlistTab {
  id: string;       // crypto.randomUUID()
  name: string;
  tickers: string[];
}

interface WatchlistsState {
  lists: WatchlistTab[];
  activeId: string;

  // List management
  addList: () => void;               // creates "Watchlist N", sets it active
  removeList: (id: string) => void;  // deletes list + all its tickers
  renameList: (id: string, name: string) => void;
  setActiveList: (id: string) => void;

  // Ticker management (operates on the active list)
  addTicker: (symbol: string) => void;   // uppercase, trim, dedupe
  removeTicker: (symbol: string) => void;
}
```

**Initial state:** one list `{ id: uuid, name: "My Watchlist", tickers: [] }`, `activeId` pointing to it.

**`addList`:** creates a new list named `"Watchlist N"` where N is `lists.length + 1`, sets `activeId` to the new list's id.

**`removeList`:** guarded — no-op if `lists.length === 1`. Removes the list by id. If the removed list was active, switches `activeId` to the first remaining list.

**`addTicker` / `removeTicker`:** operate on `lists.find(l => l.id === activeId).tickers`.

## Architecture

### Files Changed

| File | Change |
|---|---|
| `frontend/src/store/watchlistsStore.ts` | **New** — replaces watchlistStore |
| `frontend/src/store/watchlistStore.ts` | **Deleted** |
| `frontend/src/components/layout/WatchlistSidebar.tsx` | **Rewritten** — add tab bar, inline rename, delete confirmation |

### Component: `WatchlistSidebar.tsx`

A `"use client"` component. Structure (top to bottom):

```
<aside>  ← same sticky positioning as before
  <TabBar />         ← inline, not a separate file
  [DeleteBanner]     ← conditional, shown when deletingId is set
  <InputRow />       ← add ticker input + button
  <TickerList />     ← tickers of the active list
</aside>
```

These are not separate files — they are clearly separated sections within `WatchlistSidebar.tsx`.

**Local state:**

| State | Type | Purpose |
|---|---|---|
| `renamingId` | `string \| null` | Which tab is in edit mode |
| `renameValue` | `string` | Current value of the rename input |
| `deletingId` | `string \| null` | Which tab is showing delete confirmation |
| `input` | `string` | Ticker add input value |

### Tab Bar

- Horizontally scrollable (`overflow-x: auto`, `scrollbar-width: none`)
- Each tab: clickable → `setActiveList(id)`. Active tab: `border-bottom: 2px solid emerald`, `text-emerald-400`. Inactive: `text-gray-500`.
- Each tab has a `×` button: clicking it sets `deletingId = id` (shows the confirmation banner). The `×` is **hidden** when `lists.length === 1` (can't delete last list).
- Double-clicking a tab's name sets `renamingId = id`, `renameValue = list.name` → the name text becomes an `<input>`.
- Rename input: `onBlur` and `onKeyDown Enter` → call `renameList(renamingId, renameValue.trim() || list.name)` then `setRenamingId(null)`. `onKeyDown Escape` → cancel without saving.
- `+` button at the far right: calls `addList()` then immediately sets `renamingId` to the new list's id and `renameValue` to the default name — so the new tab opens directly in rename mode (same behaviour as TradingView).

### Delete Confirmation Banner

Shown inline below the tab bar when `deletingId` is set:

```
┌──────────────────────────────┐
│ Delete "Tech"?                │
│ This will remove 3 tickers.  │
│ This can't be undone.        │
│  [Delete]        [Cancel]    │
└──────────────────────────────┘
```

- "Delete" → calls `removeList(deletingId)`, sets `deletingId = null`
- "Cancel" → sets `deletingId = null`
- Styled: red border (`border-red-900`), red title (`text-red-300`), red delete button

### Input Row & Ticker List

Unchanged from the current implementation — same input + `+` button, same ticker rows with sibling `<button>` elements (load + delete). Tickers are sourced from `activeList.tickers`.

## Data Flow

```
User clicks + tab
  → addList() → new list becomes active → user double-clicks to rename

User double-clicks tab name
  → renamingId set → input shown → Enter/blur → renameList() → input hidden

User clicks × on tab
  → deletingId set → confirmation banner shown
  → "Delete" → removeList() → banner hidden, adjacent list becomes active

User adds ticker
  → addTicker(symbol) → appended to active list's tickers array → persisted

Page reload
  → Zustand persist reads localStorage["watchlists"]
  → all lists + activeId hydrated via useEffect rehydrate
```

## Edge Cases

| Case | Handling |
|---|---|
| Delete last list | `removeList` is no-op; `×` button hidden when `lists.length === 1` |
| Rename to empty string | Falls back to previous name (`renameValue.trim() \|\| list.name`) |
| Rename with Escape | Cancels without saving (`setRenamingId(null)`, `renameValue` discarded) |
| New list name collision | Allowed — names don't need to be unique |
| Tab overflow | Tab bar scrolls horizontally (`overflow-x: auto`) |
| Existing `localStorage["watchlist"]` data | Silently ignored — new key `"watchlists"` starts fresh |
| Active list deleted | `removeList` switches `activeId` to `lists[0]` |

## Out of Scope

- Drag-to-reorder tabs
- Drag tickers between lists
- Duplicate/copy a watchlist
- Per-list colour coding
