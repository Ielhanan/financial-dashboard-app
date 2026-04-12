"use client";

import { useEffect, useState, useRef } from "react";
import { createMarketWebSocket } from "@/lib/api";
import type { MarketSnapshot } from "@/types/financial";

export function useMarketSocket(ticker: string) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = createMarketWebSocket(ticker, (data) => {
      setSnapshot(data);
      setConnected(true);
    });

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [ticker]);

  return { snapshot, connected };
}
