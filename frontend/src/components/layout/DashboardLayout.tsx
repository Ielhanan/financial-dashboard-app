"use client";

import { ReactNode } from "react";
import { TickerSearch } from "./TickerSearch";
import { WatchlistSidebar } from "./WatchlistSidebar";
import { useThemeStore } from "@/store/themeStore";

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { theme, toggle } = useThemeStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-250">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
            Financial Dashboard
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Fundamental Analysis</p>
        </div>
        <TickerSearch />
      </header>

      {/* Theme toggle — fixed top-right */}
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="fixed top-3.5 right-5 z-50 p-2 rounded-lg
                   text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white
                   bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
                   border border-gray-200 dark:border-gray-700
                   transition-all duration-200 shadow-sm"
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="flex">
        <WatchlistSidebar />
        <main className="flex-1 min-w-0 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
          {children}
        </main>
      </div>
    </div>
  );
}
