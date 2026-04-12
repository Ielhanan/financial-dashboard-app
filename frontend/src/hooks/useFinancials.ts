import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useEPSRevenue(ticker: string) {
  return useQuery({
    queryKey: ["eps-revenue", ticker],
    queryFn: () => api.getEPSRevenue(ticker),
    enabled: !!ticker,
  });
}

export function useCash(ticker: string) {
  return useQuery({
    queryKey: ["cash", ticker],
    queryFn: () => api.getCash(ticker),
    enabled: !!ticker,
  });
}

export function useOrderBacklog(ticker: string) {
  return useQuery({
    queryKey: ["order-backlog", ticker],
    queryFn: () => api.getOrderBacklog(ticker),
    enabled: !!ticker,
  });
}

export function useRatios(ticker: string) {
  return useQuery({
    queryKey: ["ratios", ticker],
    queryFn: () => api.getRatios(ticker),
    enabled: !!ticker,
  });
}

export function useOwnership(ticker: string) {
  return useQuery({
    queryKey: ["ownership", ticker],
    queryFn: () => api.getOwnership(ticker),
    enabled: !!ticker,
  });
}

export function useDividends(ticker: string) {
  return useQuery({
    queryKey: ["dividends", ticker],
    queryFn: () => api.getDividends(ticker),
    enabled: !!ticker,
  });
}

export function useNews(ticker: string) {
  return useQuery({
    queryKey: ["news", ticker],
    queryFn: () => api.getNews(ticker),
    enabled: !!ticker,
  });
}
