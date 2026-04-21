# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack financial dashboard that fetches equity data from Financial Modeling Prep (FMP) and displays it in a Next.js frontend. Users type a ticker symbol and the dashboard populates all modules for that ticker.

> **Migration in progress:** The backend is being migrated from yfinance → FMP. `market_service.py` uses FMP; `financials_service.py`, `ratios_service.py`, `ownership_service.py`, and `news_service.py` still use `ticker_cache.py`/yfinance but are queued for migration.

## Commands

### Backend (FastAPI)

```bash
# From repo root, activate venv first
cd backend
source .venv/Scripts/activate   # Windows Git Bash
# or: .venv\Scripts\activate.bat  (cmd)

# Run dev server
uvicorn app.main:app --reload --port 8000

# Run all tests
pytest

# Run a single test file
pytest tests/test_market.py

# Run a single test by name
pytest tests/test_market.py::test_market_snapshot
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

### Environment

- Backend reads `backend/.env` — set `FINANCIAL_API_KEY` (required for FMP endpoints), and optionally `CORS_ORIGINS` or `WS_UPDATE_INTERVAL_SECONDS`.
- Frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local` (defaults to `http://localhost:8000`).

## Architecture

### Data Flow

1. User types a ticker in `TickerSearch` → updates Zustand store (`useTickerStore`)
2. All dashboard modules subscribe to the store and re-fetch their data via `src/lib/api.ts` (axios) when the ticker changes
3. `MarketPerformanceCard` connects via WebSocket (`/ws/market/{ticker}`) instead of REST; the hook is `useMarketSocket`
4. Backend routes all delegate to service modules

### Data Layer (FMP)

`backend/app/services/fmp_client.py` owns all FMP HTTP calls. Key properties:

- **Per-(ticker, endpoint) asyncio.Lock** — concurrent requests for different endpoints proceed in parallel; duplicate requests for the same endpoint collapse to one HTTP call.
- **Stale-on-error** — if a fetch fails and a stale cache entry exists, it is returned rather than crashing.
- **TTLs:** quote=5 min, ratios/holders=1 hr, statements=24 hr, news=30 min.

Service files call `fmp_client` functions directly (e.g. `get_quote`, `get_income_statements_quarterly`). Do not bypass `fmp_client` to call FMP directly.

### Transitional: ticker_cache.py (yfinance)

Services not yet migrated to FMP still call `get_ticker(ticker)` and `get_ticker_info(ticker)` from `ticker_cache.py`. This module:

- Uses a **shared `requests.Session`** with a browser User-Agent (avoids Yahoo Finance 429s from bare `python-requests/x.y.z`).
- Has **two cache tiers**: `INFO_CACHE_TTL=5 min` for price data (used by the WebSocket market card), `FINANCIAL_CACHE_TTL=1 hr` for full financial statements.
- Does **not** use `requests_cache` — it was deliberately removed because it cached Yahoo's session cookies after expiry, causing 429s on the crumb fetch itself and poisoning subsequent requests.

When modifying yfinance-based services, call `get_ticker(ticker)` / `get_ticker_info(ticker)` rather than constructing `yf.Ticker(ticker)` directly. For new services, use `fmp_client` instead.

### Backend Structure

```
backend/app/
  main.py          — FastAPI app, CORS middleware, router registration
  config.py        — Pydantic Settings (reads .env); includes financial_api_key
  models/schemas.py — All Pydantic response models
  routers/         — One router per domain: market, financials, ratios, ownership, news
  services/        — Business logic; each service mirrors its router
  services/fmp_client.py   — FMP HTTP client + in-process cache (authoritative for migrated services)
  services/ticker_cache.py — Legacy yfinance cache (being phased out)
```

All routers use the prefix `/api`. The market router also exposes a WebSocket at `/ws/market/{ticker}` that pushes a `MarketSnapshot` every `ws_update_interval_seconds` (default 3 s).

### Frontend Structure

```
frontend/src/
  app/page.tsx         — Single dashboard page; assembles all modules in a 12-col grid
  components/layout/   — DashboardLayout (shell + header) and TickerSearch
  components/market/   — MarketPerformanceCard (WebSocket-fed live data)
  components/financials/ — EPSRevenueChart, CashChart, OrderBacklogChart
  components/ratios/   — RatiosModule
  components/ownership/ — OwnershipModule (ownership breakdown + dividends)
  components/news/     — NewsFeed
  hooks/               — useMarketSocket (WebSocket), useFinancials (REST fetch)
  lib/api.ts           — All HTTP and WebSocket client calls; BASE_URL from env
  store/tickerStore.ts — Zustand store; single source of truth for active ticker
  types/financial.ts   — TypeScript types mirroring backend Pydantic schemas
```

### Tests

Tests live in `backend/tests/`. `conftest.py` provides an async HTTPX `AsyncClient` fixture wired to the FastAPI app (no live server needed). `pytest.ini` sets `asyncio_mode = auto`. Migrated services mock `fmp_client` functions; legacy services mock `ticker_cache` functions.
