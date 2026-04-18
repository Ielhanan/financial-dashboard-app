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
    const newId = addList();           // addList returns the new id and sets it active
    const newList = useWatchlistsStore.getState().lists.find((l) => l.id === newId);
    setRenamingId(newId);
    setRenameValue(newList?.name ?? "");
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
              className={`group flex items-center gap-1 px-2.5 py-2 cursor-pointer flex-shrink-0 border-b-2 transition-colors select-none
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
