import { ReactNode } from "react";
import { TickerSearch } from "./TickerSearch";
import { WatchlistSidebar } from "./WatchlistSidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Financial Dashboard</h1>
          <p className="text-xs text-gray-500">Fundamental Analysis</p>
        </div>
        <TickerSearch />
      </header>
      <div className="flex">
        <WatchlistSidebar />
        <main className="flex-1 min-w-0 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
          {children}
        </main>
      </div>
    </div>
  );
}
