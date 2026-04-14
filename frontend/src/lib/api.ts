import axios from "axios";
import type {
  MarketSnapshot,
  EPSRevenueResponse,
  CashResponse,
  OrderBacklogResponse,
  RatiosResponse,
  OwnershipResponse,
  DividendResponse,
  NewsResponse,
} from "@/types/financial";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const http = axios.create({ baseURL: BASE_URL });

export const api = {
  getMarket: (ticker: string) =>
    http.get<MarketSnapshot>(`/api/market/${ticker}`).then((r) => r.data),

  getEPSRevenue: (ticker: string) =>
    http.get<EPSRevenueResponse>(`/api/financials/${ticker}/eps-revenue`).then((r) => r.data),

  getCash: (ticker: string) =>
    http.get<CashResponse>(`/api/financials/${ticker}/cash`).then((r) => r.data),

  getOrderBacklog: (ticker: string) =>
    http.get<OrderBacklogResponse>(`/api/financials/${ticker}/order-backlog`).then((r) => r.data),

  getRatios: (ticker: string) =>
    http.get<RatiosResponse>(`/api/ratios/${ticker}`).then((r) => r.data),

  getOwnership: (ticker: string) =>
    http.get<OwnershipResponse>(`/api/ownership/${ticker}`).then((r) => r.data),

  getDividends: (ticker: string) =>
    http.get<DividendResponse>(`/api/ownership/${ticker}/dividends`).then((r) => r.data),

  getNews: (ticker: string) =>
    http.get<NewsResponse>(`/api/news/${ticker}`).then((r) => r.data),
};

export function createMarketWebSocket(
  ticker: string,
  onMessage: (snapshot: MarketSnapshot) => void
): WebSocket {
  const wsUrl = BASE_URL.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsUrl}/api/ws/market/${ticker}`);
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as MarketSnapshot);
    } catch {
      // ignore malformed frames
    }
  };
  return ws;
}
