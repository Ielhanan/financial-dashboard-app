import { useThemeStore } from "@/store/themeStore";

export function useChartColors() {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  return {
    grid: isDark ? "#374151" : "#e5e7eb",
    tick: isDark ? "#9ca3af" : "#6b7280",
    tooltipBg: isDark ? "#1f2937" : "#ffffff",
    tooltipBorder: isDark ? "#374151" : "#e5e7eb",
    tooltipText: isDark ? "#f9fafb" : "#111827",
    // data colours
    blue: isDark ? "#3b82f6" : "#2563eb",
    emerald: isDark ? "#10b981" : "#059669",
    purple: isDark ? "#8b5cf6" : "#7c3aed",
    amber: isDark ? "#f59e0b" : "#d97706",
    gray: isDark ? "#6b7280" : "#9ca3af",
    estimateBar: isDark ? "#4b5563" : "#d1d5db",
  };
}
