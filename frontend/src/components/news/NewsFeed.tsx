"use client";

import { useTickerStore } from "@/store/tickerStore";
import { useNews } from "@/hooks/useFinancials";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NewsFeed() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useNews(ticker);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          News —{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-mono">{ticker}</span>
        </h3>
      </div>

      {isLoading && (
        <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Loading news…</div>
      )}

      {error && (
        <div className="px-4 py-8 text-center text-red-500 dark:text-red-400 text-sm">Failed to load news.</div>
      )}

      {!isLoading && !error && (
        <div className="divide-y divide-gray-50 dark:divide-gray-700/40 max-h-[480px] overflow-y-auto">
          {(data?.items ?? []).map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white leading-snug line-clamp-2">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">{item.summary}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{item.publisher}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(item.published_at)}</p>
                </div>
              </div>
            </a>
          ))}
          {(data?.items ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              News is not available on the free FMP plan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
