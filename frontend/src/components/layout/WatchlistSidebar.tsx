// frontend/src/components/layout/WatchlistSidebar.tsx
"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { ChevronDown, Pencil, Trash2, Plus, Check, Loader2 } from "lucide-react";
import { useWatchlistsStore } from "@/store/watchlistsStore";
import { useTickerStore } from "@/store/tickerStore";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export function WatchlistSidebar() {
  const {
    lists, activeId,
    addList, renameList, setActiveList,
    addTicker, removeTicker,
  } = useWatchlistsStore();
  const { ticker, setTicker } = useTickerStore();
  const { user } = useAuth();

  const [input, setInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeList = lists.find((l) => l.id === activeId) ?? lists[0];

  // ── Ticker handlers ────────────────────────────────────────────────────────

  async function handleAddTicker() {
    const trimmed = input.trim();
    if (!trimmed || isValidating) return;

    setIsValidating(true);
    setErrorMsg(null);

    const isValid = await api.validateTicker(trimmed);

    setIsValidating(false);

    if (!isValid) {
      setErrorMsg("Invalid ticker symbol.");
      return;
    }

    addTicker(trimmed);
    setInput("");
  }

  function handleTickerKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleAddTicker();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value.toUpperCase());
    if (errorMsg) setErrorMsg(null);
  }

  // ── List handlers ──────────────────────────────────────────────────────────

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

  function handleRenameList() {
    setDropdownOpen(false);
    if (!activeList) return;
    setRenamingId(activeList.id);
    setRenameValue(activeList.name);
  }

  function handleClearList() {
    setDropdownOpen(false);
    if (!activeList) return;
    useWatchlistsStore.setState((state) => ({
      lists: state.lists.map((l) =>
        l.id === state.activeId ? { ...l, tickers: [] } : l
      ),
    }));
  }

  function handleAddList() {
    const newId = addList(user?.id ?? "");
    const newList = useWatchlistsStore.getState().lists.find((l) => l.id === newId);
    setDropdownOpen(false);
    setRenamingId(newId);
    setRenameValue(newList?.name ?? "");
  }

  function handleSelectList(id: string) {
    setActiveList(id);
    setDropdownOpen(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className="sticky top-[var(--header-h)] h-[calc(100vh-var(--header-h))] w-52 flex-shrink-0 flex flex-col bg-slate-950 border-r border-gray-700/60 overflow-hidden">

      {/* ── Dropdown header ── */}
      <div ref={dropdownRef} className="relative flex-shrink-0">

        {/* Trigger: rename input OR clickable header */}
        {renamingId === activeList?.id ? (
          <div className="px-3 py-2.5 border-b border-gray-700/60">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              className="w-full bg-gray-900 border border-emerald-500 rounded px-2 py-1 text-sm text-emerald-400 font-bold outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 border-b border-gray-700/60 hover:bg-gray-800/50 transition-colors group"
          >
            <span className="text-sm font-semibold text-white truncate">
              {activeList?.name ?? "Watchlist"}
            </span>
            <ChevronDown
              size={15}
              className={`flex-shrink-0 ml-1 text-gray-400 group-hover:text-white transition-transform duration-150 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        )}

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-50 bg-gray-900 border border-gray-700/80 rounded-b-lg shadow-2xl overflow-hidden">

            {/* Actions */}
            <button
              onClick={handleRenameList}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Pencil size={13} className="flex-shrink-0 text-gray-400" />
              Rename list
            </button>
            <button
              onClick={handleClearList}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} className="flex-shrink-0 text-gray-400" />
              Clear list
            </button>

            <div className="my-1 border-t border-gray-700/60" />

            {/* Create */}
            <button
              onClick={handleAddList}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Plus size={13} className="flex-shrink-0 text-gray-400" />
              Create new list...
            </button>

            <div className="my-1 border-t border-gray-700/60" />

            {/* List section */}
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
              Your Lists
            </p>
            {lists.map((list) => {
              const isActive = list.id === activeId;
              return (
                <button
                  key={list.id}
                  onClick={() => handleSelectList(list.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? "bg-emerald-900/30 text-emerald-400 font-semibold"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Check
                    size={12}
                    className={`flex-shrink-0 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="truncate">{list.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add ticker input ── */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleTickerKeyDown}
            placeholder="e.g. MSFT"
            maxLength={10}
            disabled={isValidating}
            className={`flex-1 min-w-0 px-2 py-1.5 rounded-md
                       bg-gray-800 border text-white placeholder-gray-500
                       text-xs font-mono uppercase
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       ${errorMsg ? "border-red-500" : "border-gray-600"}`}
          />
          <button
            onClick={handleAddTicker}
            disabled={isValidating}
            aria-label="Add ticker to watchlist"
            className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isValidating
              ? <Loader2 size={12} className="animate-spin" />
              : "+"}
          </button>
        </div>
        {errorMsg && (
          <p className="mt-1 text-[11px] text-red-400">{errorMsg}</p>
        )}
      </div>

      {/* ── Ticker list ── */}
      <ul className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
        {!activeList || activeList.tickers.length === 0 ? (
          <li className="text-gray-500 text-xs text-center pt-6 leading-relaxed">
            This watchlist is empty.<br />Add a ticker above.
          </li>
        ) : (
          activeList.tickers.map((symbol) => {
            const isActiveTicker = symbol === ticker;
            return (
              <li key={symbol} className="flex items-center gap-1.5">
                <button
                  onClick={() => setTicker(symbol)}
                  className={`flex-1 text-left rounded-md px-2.5 py-2 transition-colors group ${
                    isActiveTicker
                      ? "bg-emerald-900/30 border border-emerald-500/50"
                      : "bg-gray-800/60 border border-transparent hover:border-gray-600"
                  }`}
                >
                  <span className={`font-mono text-sm font-semibold ${
                    isActiveTicker ? "text-emerald-400" : "text-gray-300 group-hover:text-white"
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
