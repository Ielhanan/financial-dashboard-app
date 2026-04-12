# Stock Financial Monitoring Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack stock financial monitoring dashboard that shows real-time market data (MC, EV), 5-year historical financials, valuation ratios with sector benchmarks, ownership structure, dividends, and a news feed — all synchronized to a single active ticker.

**Architecture:** A FastAPI backend fetches data from `yfinance` and serves it via REST endpoints plus a WebSocket for real-time quotes. The Next.js frontend uses a Zustand store to hold the active ticker; every module subscribes to this store and re-fetches via TanStack Query when the ticker changes, guaranteeing sub-1.5s synchronization across all panels.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Recharts, Zustand, TanStack Query, Tailwind CSS, shadcn/ui, FastAPI, Python 3.11+, yfinance, pytest, httpx

---

## Scope Note

The SRS has 5 loosely-independent subsystems (Market, Financials, Ratios, Ownership/Dividends, News). They all share the ticker concept and will live on one dashboard page. This plan implements them sequentially; Tasks 3–8 (backend services) and Tasks 12–17 (frontend modules) can be executed in parallel by separate developers once the shared scaffolding (Tasks 1–3, 9–11) is in place.

---

## File Map

### Backend (`backend/`)

| File | Responsibility |
|---|---|
| `backend/app/main.py` | FastAPI app factory, CORS, router registration |
| `backend/app/config.py` | Environment config (API keys, CORS origins) |
| `backend/app/models/schemas.py` | All Pydantic request/response models |
| `backend/app/services/market_service.py` | Fetch live price, MC, EV from yfinance |
| `backend/app/services/financials_service.py` | EPS, Revenue, Cash, Order Backlog (5yr) |
| `backend/app/services/ratios_service.py` | P/E, P/B, EV/EBITDA, P/FCF, D/E + sector avg |
| `backend/app/services/ownership_service.py` | Insider/institutional ownership, dividends |
| `backend/app/services/news_service.py` | Ticker news aggregation |
| `backend/app/routers/market.py` | `GET /api/market/{ticker}`, `WS /ws/market/{ticker}` |
| `backend/app/routers/financials.py` | `GET /api/financials/{ticker}/eps-revenue`, `/cash`, `/order-backlog` |
| `backend/app/routers/ratios.py` | `GET /api/ratios/{ticker}` |
| `backend/app/routers/ownership.py` | `GET /api/ownership/{ticker}`, `/dividends` |
| `backend/app/routers/news.py` | `GET /api/news/{ticker}` |
| `backend/tests/test_market.py` | Tests for market service + router |
| `backend/tests/test_financials.py` | Tests for financials service |
| `backend/tests/test_ratios.py` | Tests for ratios service |
| `backend/tests/test_ownership.py` | Tests for ownership + dividends |
| `backend/requirements.txt` | Python dependencies |

### Frontend (`frontend/`)

| File | Responsibility |
|---|---|
| `frontend/src/types/financial.ts` | All TypeScript interfaces matching backend schemas |
| `frontend/src/lib/api.ts` | Axios client, all typed fetch functions, WebSocket factory |
| `frontend/src/store/tickerStore.ts` | Zustand store — single source of truth for active ticker |
| `frontend/src/app/layout.tsx` | Root layout: QueryClient provider, Zustand devtools |
| `frontend/src/app/page.tsx` | Dashboard page — assembles all module components |
| `frontend/src/app/globals.css` | Tailwind base styles |
| `frontend/src/components/layout/DashboardLayout.tsx` | Grid layout shell |
| `frontend/src/components/layout/TickerSearch.tsx` | Ticker search/select input, updates Zustand store |
| `frontend/src/components/shared/DataTable.tsx` | Reusable sortable table with CSV/Excel export |
| `frontend/src/components/shared/ChartWrapper.tsx` | Recharts wrapper with zoom (ReferenceArea) + tooltip |
| `frontend/src/components/market/MarketPerformanceCard.tsx` | Displays live MC + EV, connects via WebSocket |
| `frontend/src/components/financials/EPSRevenueChart.tsx` | Combo chart: bars (Revenue) + line (EPS), forecast overlay |
| `frontend/src/components/financials/CashChart.tsx` | Area chart of quarterly cash & equivalents |
| `frontend/src/components/financials/OrderBacklogChart.tsx` | Bar chart of revenue backlog proxy |
| `frontend/src/components/ratios/RatiosModule.tsx` | P/E, P/B, EV/EBITDA, P/FCF, D/E vs sector benchmarks |
| `frontend/src/components/ownership/OwnershipModule.tsx` | Insider + institutional ownership table + dividend chart |
| `frontend/src/components/news/NewsFeed.tsx` | Scrollable news cards from aggregated feed |
| `frontend/src/hooks/useMarketSocket.ts` | WebSocket hook for real-time market data |
| `frontend/src/hooks/useFinancials.ts` | TanStack Query hooks for all REST endpoints |

---

## Task 1: Initialize Backend Project

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create the backend directory and install dependencies**

```bash
mkdir -p backend/app/routers backend/app/services backend/app/models backend/tests
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

- [ ] **Step 2: Write `backend/requirements.txt`**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
websockets==12.0
yfinance==0.2.40
pydantic==2.7.1
pydantic-settings==2.2.1
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
anyio==4.3.0
```

- [ ] **Step 3: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected output: Successfully installed fastapi-0.111.0 uvicorn-0.29.0 ...

- [ ] **Step 4: Write `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:3000"]
    ws_update_interval_seconds: float = 3.0

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 5: Write `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Write `backend/tests/conftest.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
```

- [ ] **Step 7: Write a smoke test to confirm the server starts**

Create `backend/tests/test_health.py`:

```python
import pytest

@pytest.mark.anyio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 8: Run the smoke test**

```bash
cd backend
pytest tests/test_health.py -v
```

Expected output:
```
tests/test_health.py::test_health PASSED
1 passed in 0.xx s
```

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: initialize FastAPI backend with health endpoint"
```

---

## Task 2: Initialize Frontend Project

**Files:**
- Create: `frontend/` (Next.js project scaffold)
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`

- [ ] **Step 1: Scaffold the Next.js app**

Run from the project root (not inside `backend/`):

```bash
cd ..   # back to project root
npx create-next-app@14 frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias
```

When prompted: accept all defaults.

- [ ] **Step 2: Install additional frontend dependencies**

```bash
cd frontend
npm install \
  recharts \
  zustand \
  @tanstack/react-query \
  axios \
  xlsx \
  file-saver \
  @types/file-saver \
  lucide-react
```

- [ ] **Step 3: Verify the dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Expected: Next.js default welcome page. Stop the server with Ctrl+C.

- [ ] **Step 4: Replace `frontend/src/app/globals.css` with minimal Tailwind base**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-950 text-gray-100;
}
```

- [ ] **Step 5: Write `frontend/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Dashboard",
  description: "Stock fundamental analysis dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Write placeholder `frontend/src/app/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Financial Dashboard</h1>
      <p className="text-gray-400 mt-2">Select a ticker to begin.</p>
    </main>
  );
}
```

- [ ] **Step 7: Verify the page renders**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: dark background with "Financial Dashboard" heading. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: initialize Next.js 14 frontend with Tailwind and Recharts"
```

---

## Task 3: Backend — Pydantic Schemas

**Files:**
- Create: `backend/app/models/schemas.py`

All API response shapes are defined here first so services and routers import from one place.

- [ ] **Step 1: Write `backend/app/models/schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional

# --- Market ---

class MarketSnapshot(BaseModel):
    ticker: str
    price: float
    market_cap: float          # USD
    enterprise_value: float    # USD
    shares_outstanding: float
    total_debt: float
    cash: float

# --- Financials ---

class QuarterlyEPS(BaseModel):
    period: str          # "2024-Q1"
    eps_actual: Optional[float]
    eps_estimate: Optional[float]
    eps_yoy_delta_pct: Optional[float]

class QuarterlyRevenue(BaseModel):
    period: str
    revenue_actual: Optional[float]
    revenue_estimate: Optional[float]
    revenue_yoy_delta_pct: Optional[float]

class EPSRevenueResponse(BaseModel):
    ticker: str
    quarterly_eps: list[QuarterlyEPS]
    quarterly_revenue: list[QuarterlyRevenue]

class QuarterlyCash(BaseModel):
    period: str
    cash: float                # Cash and equivalents
    short_term_investments: float
    total_liquid: float        # cash + short_term_investments

class CashResponse(BaseModel):
    ticker: str
    quarterly: list[QuarterlyCash]

class AnnualBacklog(BaseModel):
    year: int
    revenue: float             # yfinance doesn't expose backlog; use revenue as proxy

class OrderBacklogResponse(BaseModel):
    ticker: str
    annual: list[AnnualBacklog]
    note: str = "Order backlog data unavailable via public API; annual revenue shown as proxy."

# --- Ratios ---

class RatioWithBenchmark(BaseModel):
    name: str
    value: Optional[float]
    sector_average: Optional[float]
    unit: str = "x"

class HistoricalRatio(BaseModel):
    year: int
    p_fcf: Optional[float]
    d_e: Optional[float]

class RatiosResponse(BaseModel):
    ticker: str
    current: list[RatioWithBenchmark]   # P/E, P/B, EV/EBITDA, P/FCF, D/E
    historical: list[HistoricalRatio]   # 5-year P/FCF and D/E trend

# --- Ownership & Dividends ---

class OwnershipRecord(BaseModel):
    holder: str
    shares: float
    pct_out: float
    holder_type: str   # "insider" | "institutional"

class OwnershipResponse(BaseModel):
    ticker: str
    insider_pct: float
    institutional_pct: float
    top_holders: list[OwnershipRecord]

class DividendRecord(BaseModel):
    date: str           # ISO date string
    amount: float
    yield_pct: Optional[float]
    ex_date: Optional[str]
    declaration_date: Optional[str]

class DividendResponse(BaseModel):
    ticker: str
    dividends: list[DividendRecord]

# --- News ---

class NewsItem(BaseModel):
    title: str
    publisher: str
    link: str
    published_at: str   # ISO datetime string
    summary: Optional[str]

class NewsResponse(BaseModel):
    ticker: str
    items: list[NewsItem]
```

- [ ] **Step 2: Verify schemas import cleanly**

```bash
cd backend
python -c "from app.models.schemas import MarketSnapshot, RatiosResponse; print('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "feat: define all Pydantic response schemas"
```

---

## Task 4: Backend — Market Service + WebSocket Router

**Files:**
- Create: `backend/app/services/market_service.py`
- Create: `backend/app/routers/market.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_market.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_market.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from app.services.market_service import get_market_snapshot
from app.models.schemas import MarketSnapshot

MOCK_INFO = {
    "currentPrice": 175.50,
    "marketCap": 2_700_000_000_000,
    "sharesOutstanding": 15_400_000_000,
    "totalDebt": 108_000_000_000,
    "totalCash": 73_000_000_000,
    "enterpriseValue": 2_735_000_000_000,
}

@pytest.mark.anyio
async def test_get_market_snapshot_returns_schema():
    with patch("app.services.market_service.yf.Ticker") as mock_ticker_cls:
        mock_ticker = MagicMock()
        mock_ticker.info = MOCK_INFO
        mock_ticker_cls.return_value = mock_ticker

        result = await get_market_snapshot("AAPL")

    assert isinstance(result, MarketSnapshot)
    assert result.ticker == "AAPL"
    assert result.price == 175.50
    assert result.market_cap == 2_700_000_000_000

@pytest.mark.anyio
async def test_get_market_snapshot_computes_ev_when_missing():
    info_no_ev = {**MOCK_INFO, "enterpriseValue": None}
    with patch("app.services.market_service.yf.Ticker") as mock_ticker_cls:
        mock_ticker = MagicMock()
        mock_ticker.info = info_no_ev
        mock_ticker_cls.return_value = mock_ticker

        result = await get_market_snapshot("AAPL")

    # EV = MC + Debt - Cash
    expected_ev = MOCK_INFO["marketCap"] + MOCK_INFO["totalDebt"] - MOCK_INFO["totalCash"]
    assert result.enterprise_value == expected_ev
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_market.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — `market_service` doesn't exist yet.

- [ ] **Step 3: Write `backend/app/services/market_service.py`**

```python
import asyncio
import yfinance as yf
from app.models.schemas import MarketSnapshot

async def get_market_snapshot(ticker: str) -> MarketSnapshot:
    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(None, lambda: yf.Ticker(ticker).info)

    price = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0
    market_cap = info.get("marketCap") or 0.0
    total_debt = info.get("totalDebt") or 0.0
    cash = info.get("totalCash") or 0.0
    shares = info.get("sharesOutstanding") or 0.0

    ev = info.get("enterpriseValue")
    if ev is None:
        ev = market_cap + total_debt - cash

    return MarketSnapshot(
        ticker=ticker.upper(),
        price=price,
        market_cap=market_cap,
        enterprise_value=ev,
        shares_outstanding=shares,
        total_debt=total_debt,
        cash=cash,
    )
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pytest tests/test_market.py -v
```

Expected:
```
tests/test_market.py::test_get_market_snapshot_returns_schema PASSED
tests/test_market.py::test_get_market_snapshot_computes_ev_when_missing PASSED
2 passed
```

- [ ] **Step 5: Write `backend/app/routers/market.py`**

```python
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.market_service import get_market_snapshot
from app.config import settings

router = APIRouter(prefix="/api", tags=["market"])

@router.get("/market/{ticker}")
async def get_market(ticker: str):
    return await get_market_snapshot(ticker.upper())

@router.websocket("/ws/market/{ticker}")
async def market_websocket(websocket: WebSocket, ticker: str):
    await websocket.accept()
    try:
        while True:
            snapshot = await get_market_snapshot(ticker.upper())
            await websocket.send_text(snapshot.model_dump_json())
            await asyncio.sleep(settings.ws_update_interval_seconds)
    except WebSocketDisconnect:
        pass
```

- [ ] **Step 6: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import market

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Write REST endpoint test**

Append to `backend/tests/test_market.py`:

```python
@pytest.mark.anyio
async def test_market_rest_endpoint(client):
    with patch("app.services.market_service.yf.Ticker") as mock_ticker_cls:
        mock_ticker = MagicMock()
        mock_ticker.info = MOCK_INFO
        mock_ticker_cls.return_value = mock_ticker

        response = await client.get("/api/market/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["price"] == 175.50
    assert "enterprise_value" in data
```

- [ ] **Step 8: Run all market tests**

```bash
pytest tests/test_market.py -v
```

Expected: 3 passed.

- [ ] **Step 9: Manually smoke-test the live endpoint**

```bash
uvicorn app.main:app --reload --port 8000
# In a second terminal:
curl http://localhost:8000/api/market/AAPL
```

Expected: JSON with price, market_cap, enterprise_value for AAPL. Stop uvicorn with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/market_service.py backend/app/routers/market.py backend/app/main.py backend/tests/test_market.py
git commit -m "feat: market service with REST and WebSocket endpoints"
```

---

## Task 5: Backend — Financials Service

**Files:**
- Create: `backend/app/services/financials_service.py`
- Create: `backend/app/routers/financials.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_financials.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_financials.py`:

```python
import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock
from app.services.financials_service import (
    get_eps_revenue,
    get_cash_data,
    get_order_backlog,
)
from app.models.schemas import EPSRevenueResponse, CashResponse, OrderBacklogResponse

def _make_mock_ticker():
    mock = MagicMock()

    # quarterly_financials: columns are Timestamps, rows are line items
    dates = pd.to_datetime(["2024-03-31", "2023-12-31", "2023-09-30", "2023-06-30"])
    mock.quarterly_financials = pd.DataFrame(
        {d: {"Total Revenue": 1e11 + i * 1e9} for i, d in enumerate(dates)}
    )
    mock.quarterly_earnings = pd.DataFrame({
        "Earnings": [3.0, 2.8, 2.5, 2.2],
        "Revenue": [1e11, 9.9e10, 9.8e10, 9.7e10],
    }, index=pd.to_datetime(["2024-03-31", "2023-12-31", "2023-09-30", "2023-06-30"]))

    mock.quarterly_balance_sheet = pd.DataFrame(
        {d: {
            "Cash And Cash Equivalents": 2e10,
            "Short Term Investments": 1e10,
        } for d in dates}
    )
    mock.financials = pd.DataFrame(
        {pd.Timestamp("2023-12-31"): {"Total Revenue": 3.85e11},
         pd.Timestamp("2022-12-31"): {"Total Revenue": 3.94e11}}
    )
    return mock

@pytest.mark.anyio
async def test_get_eps_revenue_returns_schema():
    with patch("app.services.financials_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_eps_revenue("AAPL")
    assert isinstance(result, EPSRevenueResponse)
    assert result.ticker == "AAPL"
    assert len(result.quarterly_revenue) > 0

@pytest.mark.anyio
async def test_get_cash_data_returns_schema():
    with patch("app.services.financials_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_cash_data("AAPL")
    assert isinstance(result, CashResponse)
    assert all(r.total_liquid == r.cash + r.short_term_investments for r in result.quarterly)

@pytest.mark.anyio
async def test_get_order_backlog_returns_revenue_proxy():
    with patch("app.services.financials_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_order_backlog("AAPL")
    assert isinstance(result, OrderBacklogResponse)
    assert len(result.annual) >= 1
    assert "proxy" in result.note.lower()
```

- [ ] **Step 2: Run — confirm fail**

```bash
pytest tests/test_financials.py -v
```

Expected: `ImportError` for `financials_service`.

- [ ] **Step 3: Write `backend/app/services/financials_service.py`**

```python
import asyncio
from typing import Optional
import yfinance as yf
import pandas as pd
from app.models.schemas import (
    EPSRevenueResponse, QuarterlyEPS, QuarterlyRevenue,
    CashResponse, QuarterlyCash,
    OrderBacklogResponse, AnnualBacklog,
)


def _fmt_period(ts) -> str:
    """Convert a pandas Timestamp to '2024-Q1' format."""
    q = (ts.month - 1) // 3 + 1
    return f"{ts.year}-Q{q}"


def _yoy_delta(current: Optional[float], prior: Optional[float]) -> Optional[float]:
    if current is None or prior is None or prior == 0:
        return None
    return round((current - prior) / abs(prior) * 100, 2)


async def get_eps_revenue(ticker: str) -> EPSRevenueResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    qe = t.quarterly_earnings  # index: date, cols: Earnings, Revenue
    qf = t.quarterly_financials  # cols: date, rows: line items

    eps_records: list[QuarterlyEPS] = []
    rev_records: list[QuarterlyRevenue] = []

    if qe is not None and not qe.empty:
        qe_sorted = qe.sort_index()
        dates = list(qe_sorted.index)
        eps_vals = list(qe_sorted["Earnings"]) if "Earnings" in qe_sorted.columns else []
        rev_vals = list(qe_sorted["Revenue"]) if "Revenue" in qe_sorted.columns else []

        for i, date in enumerate(dates):
            period = _fmt_period(date)
            eps = eps_vals[i] if i < len(eps_vals) else None
            rev = rev_vals[i] if i < len(rev_vals) else None
            prior_eps = eps_vals[i - 4] if i >= 4 and eps_vals else None
            prior_rev = rev_vals[i - 4] if i >= 4 and rev_vals else None

            eps_records.append(QuarterlyEPS(
                period=period,
                eps_actual=float(eps) if eps is not None else None,
                eps_estimate=None,   # yfinance free tier: no analyst estimates
                eps_yoy_delta_pct=_yoy_delta(eps, prior_eps),
            ))
            rev_records.append(QuarterlyRevenue(
                period=period,
                revenue_actual=float(rev) if rev is not None else None,
                revenue_estimate=None,
                revenue_yoy_delta_pct=_yoy_delta(rev, prior_rev),
            ))

    return EPSRevenueResponse(
        ticker=ticker.upper(),
        quarterly_eps=eps_records[-20:],     # last 5 years = 20 quarters
        quarterly_revenue=rev_records[-20:],
    )


async def get_cash_data(ticker: str) -> CashResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    bs = t.quarterly_balance_sheet  # cols: date, rows: line items

    records: list[QuarterlyCash] = []
    if bs is not None and not bs.empty:
        for col in sorted(bs.columns)[-20:]:   # up to 20 quarters
            cash = float(bs.loc["Cash And Cash Equivalents", col]) if "Cash And Cash Equivalents" in bs.index else 0.0
            sti = float(bs.loc["Short Term Investments", col]) if "Short Term Investments" in bs.index else 0.0
            records.append(QuarterlyCash(
                period=_fmt_period(col),
                cash=cash,
                short_term_investments=sti,
                total_liquid=cash + sti,
            ))

    return CashResponse(ticker=ticker.upper(), quarterly=records)


async def get_order_backlog(ticker: str) -> OrderBacklogResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    fin = t.financials   # annual; cols: date, rows: line items
    records: list[AnnualBacklog] = []

    if fin is not None and not fin.empty:
        for col in sorted(fin.columns)[-5:]:
            rev = fin.loc["Total Revenue", col] if "Total Revenue" in fin.index else 0.0
            records.append(AnnualBacklog(year=col.year, revenue=float(rev)))

    return OrderBacklogResponse(
        ticker=ticker.upper(),
        annual=records,
        note="Order backlog data unavailable via public API; annual revenue shown as proxy.",
    )
```

- [ ] **Step 4: Run — expect PASS**

```bash
pytest tests/test_financials.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Write `backend/app/routers/financials.py`**

```python
from fastapi import APIRouter
from app.services.financials_service import get_eps_revenue, get_cash_data, get_order_backlog

router = APIRouter(prefix="/api/financials", tags=["financials"])

@router.get("/{ticker}/eps-revenue")
async def eps_revenue(ticker: str):
    return await get_eps_revenue(ticker.upper())

@router.get("/{ticker}/cash")
async def cash(ticker: str):
    return await get_cash_data(ticker.upper())

@router.get("/{ticker}/order-backlog")
async def order_backlog(ticker: str):
    return await get_order_backlog(ticker.upper())
```

- [ ] **Step 6: Register router in `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import market, financials

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(financials.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Run all backend tests**

```bash
pytest tests/ -v
```

Expected: 6 passed (health + 2 market + 3 financials).

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/financials_service.py backend/app/routers/financials.py backend/app/main.py backend/tests/test_financials.py
git commit -m "feat: financials service for EPS, revenue, cash, and order backlog"
```

---

## Task 6: Backend — Ratios Service

**Files:**
- Create: `backend/app/services/ratios_service.py`
- Create: `backend/app/routers/ratios.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_ratios.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_ratios.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from app.services.ratios_service import get_ratios
from app.models.schemas import RatiosResponse

MOCK_INFO = {
    "trailingPE": 28.5,
    "priceToBook": 45.2,
    "enterpriseToEbitda": 22.1,
    "freeCashflow": 90_000_000_000,
    "marketCap": 2_700_000_000_000,
    "totalDebt": 108_000_000_000,
    "totalStockholderEquity": 62_000_000_000,
    "sector": "Technology",
    # Sector peer P/E (hardcoded benchmarks per sector)
}

def _make_mock_ticker_with_cashflow():
    mock = MagicMock()
    mock.info = MOCK_INFO
    dates = pd.to_datetime(["2023-12-31", "2022-12-31", "2021-12-31", "2020-12-31", "2019-12-31"])
    mock.cashflow = pd.DataFrame(
        {d: {
            "Total Cash From Operating Activities": 1e11 + i * 1e9,
            "Capital Expenditures": -1e10,
        } for i, d in enumerate(dates)}
    )
    mock.balance_sheet = pd.DataFrame(
        {d: {
            "Total Debt": 1e11,
            "Total Stockholder Equity": 6e10,
        } for i, d in enumerate(dates)}
    )
    return mock

@pytest.mark.anyio
async def test_get_ratios_returns_schema():
    with patch("app.services.ratios_service.yf.Ticker", return_value=_make_mock_ticker_with_cashflow()):
        result = await get_ratios("AAPL")
    assert isinstance(result, RatiosResponse)
    assert result.ticker == "AAPL"

@pytest.mark.anyio
async def test_get_ratios_has_five_current_ratios():
    with patch("app.services.ratios_service.yf.Ticker", return_value=_make_mock_ticker_with_cashflow()):
        result = await get_ratios("AAPL")
    names = [r.name for r in result.current]
    assert "P/E" in names
    assert "P/B" in names
    assert "EV/EBITDA" in names
    assert "P/FCF" in names
    assert "D/E" in names

@pytest.mark.anyio
async def test_get_ratios_historical_has_five_years():
    with patch("app.services.ratios_service.yf.Ticker", return_value=_make_mock_ticker_with_cashflow()):
        result = await get_ratios("AAPL")
    assert len(result.historical) == 5
```

- [ ] **Step 2: Run — confirm fail**

```bash
pytest tests/test_ratios.py -v
```

Expected: `ImportError` for `ratios_service`.

- [ ] **Step 3: Write `backend/app/services/ratios_service.py`**

```python
import asyncio
from typing import Optional
import yfinance as yf
from app.models.schemas import RatiosResponse, RatioWithBenchmark, HistoricalRatio

# Hardcoded sector median P/E benchmarks (rough S&P sector averages)
SECTOR_PE_BENCHMARKS: dict[str, float] = {
    "Technology": 28.0,
    "Healthcare": 22.0,
    "Financial Services": 14.0,
    "Consumer Cyclical": 20.0,
    "Communication Services": 18.0,
    "Industrials": 20.0,
    "Consumer Defensive": 22.0,
    "Energy": 12.0,
    "Utilities": 16.0,
    "Real Estate": 30.0,
    "Basic Materials": 15.0,
}

SECTOR_PB_BENCHMARKS: dict[str, float] = {
    "Technology": 8.0,
    "Healthcare": 5.0,
    "Financial Services": 1.3,
    "Consumer Cyclical": 4.5,
    "Communication Services": 3.5,
    "Industrials": 3.5,
    "Consumer Defensive": 5.0,
    "Energy": 1.8,
    "Utilities": 1.6,
    "Real Estate": 2.0,
    "Basic Materials": 2.0,
}


def _safe_float(val) -> Optional[float]:
    try:
        v = float(val)
        return round(v, 2) if v == v else None   # NaN check
    except (TypeError, ValueError):
        return None


async def get_ratios(ticker: str) -> RatiosResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    info = t.info
    sector = info.get("sector", "Technology")

    pe = _safe_float(info.get("trailingPE"))
    pb = _safe_float(info.get("priceToBook"))
    ev_ebitda = _safe_float(info.get("enterpriseToEbitda"))
    market_cap = _safe_float(info.get("marketCap")) or 0.0
    fcf = _safe_float(info.get("freeCashflow"))
    p_fcf = round(market_cap / fcf, 2) if fcf and fcf > 0 else None

    total_debt = _safe_float(info.get("totalDebt")) or 0.0
    equity = _safe_float(info.get("totalStockholderEquity")) or 1.0
    d_e = round(total_debt / equity, 2) if equity != 0 else None

    current = [
        RatioWithBenchmark(name="P/E", value=pe, sector_average=SECTOR_PE_BENCHMARKS.get(sector)),
        RatioWithBenchmark(name="P/B", value=pb, sector_average=SECTOR_PB_BENCHMARKS.get(sector)),
        RatioWithBenchmark(name="EV/EBITDA", value=ev_ebitda, sector_average=15.0),
        RatioWithBenchmark(name="P/FCF", value=p_fcf, sector_average=20.0),
        RatioWithBenchmark(name="D/E", value=d_e, sector_average=1.5),
    ]

    # Historical: pull from annual cashflow + balance sheet
    historical: list[HistoricalRatio] = []
    cf = t.cashflow
    bs = t.balance_sheet

    if cf is not None and not cf.empty and bs is not None and not bs.empty:
        for col in sorted(cf.columns)[-5:]:
            op_cf = cf.loc["Total Cash From Operating Activities", col] if "Total Cash From Operating Activities" in cf.index else None
            capex = cf.loc["Capital Expenditures", col] if "Capital Expenditures" in cf.index else None
            hist_fcf = float(op_cf) + float(capex) if op_cf is not None and capex is not None else None

            hist_debt = float(bs.loc["Total Debt", col]) if "Total Debt" in bs.index and col in bs.columns else None
            hist_equity = float(bs.loc["Total Stockholder Equity", col]) if "Total Stockholder Equity" in bs.index and col in bs.columns else None

            hist_p_fcf = round(market_cap / hist_fcf, 2) if hist_fcf and hist_fcf > 0 else None
            hist_de = round(hist_debt / hist_equity, 2) if hist_debt is not None and hist_equity and hist_equity != 0 else None

            historical.append(HistoricalRatio(
                year=col.year,
                p_fcf=hist_p_fcf,
                d_e=hist_de,
            ))

    return RatiosResponse(ticker=ticker.upper(), current=current, historical=historical)
```

- [ ] **Step 4: Run — expect PASS**

```bash
pytest tests/test_ratios.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Write `backend/app/routers/ratios.py`**

```python
from fastapi import APIRouter
from app.services.ratios_service import get_ratios

router = APIRouter(prefix="/api/ratios", tags=["ratios"])

@router.get("/{ticker}")
async def ratios(ticker: str):
    return await get_ratios(ticker.upper())
```

- [ ] **Step 6: Register router in `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import market, financials, ratios

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(financials.router)
app.include_router(ratios.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Run all tests**

```bash
pytest tests/ -v
```

Expected: 9 passed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/ratios_service.py backend/app/routers/ratios.py backend/app/main.py backend/tests/test_ratios.py
git commit -m "feat: ratios service with P/E, P/B, EV/EBITDA, P/FCF, D/E and sector benchmarks"
```

---

## Task 7: Backend — Ownership & Dividends Service

**Files:**
- Create: `backend/app/services/ownership_service.py`
- Create: `backend/app/routers/ownership.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_ownership.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_ownership.py`:

```python
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from app.services.ownership_service import get_ownership, get_dividends
from app.models.schemas import OwnershipResponse, DividendResponse

def _make_mock_ticker():
    mock = MagicMock()
    mock.info = {"heldPercentInsiders": 0.03, "heldPercentInstitutions": 0.62}

    mock.institutional_holders = pd.DataFrame({
        "Holder": ["Vanguard Group", "BlackRock"],
        "Shares": [1_200_000_000, 1_000_000_000],
        "% Out": [0.079, 0.065],
    })
    mock.insider_purchases = pd.DataFrame()

    dates = pd.to_datetime(["2024-02-09", "2023-11-10", "2023-08-11"])
    mock.dividends = pd.Series([0.24, 0.24, 0.24], index=dates, name="Dividends")
    mock.info["trailingAnnualDividendYield"] = 0.0054
    return mock

@pytest.mark.anyio
async def test_get_ownership_returns_schema():
    with patch("app.services.ownership_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_ownership("AAPL")
    assert isinstance(result, OwnershipResponse)
    assert result.ticker == "AAPL"
    assert 0 <= result.insider_pct <= 100
    assert len(result.top_holders) > 0

@pytest.mark.anyio
async def test_get_dividends_returns_schema():
    with patch("app.services.ownership_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_dividends("AAPL")
    assert isinstance(result, DividendResponse)
    assert len(result.dividends) == 3
    assert result.dividends[0].amount == 0.24
```

- [ ] **Step 2: Run — confirm fail**

```bash
pytest tests/test_ownership.py -v
```

- [ ] **Step 3: Write `backend/app/services/ownership_service.py`**

```python
import asyncio
import yfinance as yf
from app.models.schemas import (
    OwnershipResponse, OwnershipRecord,
    DividendResponse, DividendRecord,
)


async def get_ownership(ticker: str) -> OwnershipResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    info = t.info
    insider_pct = float(info.get("heldPercentInsiders") or 0.0) * 100
    inst_pct = float(info.get("heldPercentInstitutions") or 0.0) * 100

    holders: list[OwnershipRecord] = []
    ih = t.institutional_holders
    if ih is not None and not ih.empty:
        for _, row in ih.head(10).iterrows():
            holders.append(OwnershipRecord(
                holder=str(row.get("Holder", "")),
                shares=float(row.get("Shares", 0)),
                pct_out=float(row.get("% Out", 0)) * 100,
                holder_type="institutional",
            ))

    return OwnershipResponse(
        ticker=ticker.upper(),
        insider_pct=round(insider_pct, 2),
        institutional_pct=round(inst_pct, 2),
        top_holders=holders,
    )


async def get_dividends(ticker: str) -> DividendResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    divs = t.dividends
    yield_pct = float(t.info.get("trailingAnnualDividendYield") or 0.0) * 100

    records: list[DividendRecord] = []
    if divs is not None and not divs.empty:
        # last 5 years of dividends
        cutoff = divs.index.max() - pd.DateOffset(years=5) if not divs.empty else None
        recent = divs[divs.index >= cutoff] if cutoff is not None else divs

        for date, amount in recent.items():
            records.append(DividendRecord(
                date=date.date().isoformat(),
                amount=float(amount),
                yield_pct=round(yield_pct, 2),
                ex_date=None,
                declaration_date=None,
            ))

    return DividendResponse(ticker=ticker.upper(), dividends=records)
```

- [ ] **Step 4: Add missing import to `ownership_service.py`**

Add at top:

```python
import pandas as pd
```

(The `pd.DateOffset` reference requires this import.)

- [ ] **Step 5: Write `backend/app/routers/ownership.py`**

```python
from fastapi import APIRouter
from app.services.ownership_service import get_ownership, get_dividends

router = APIRouter(prefix="/api/ownership", tags=["ownership"])

@router.get("/{ticker}")
async def ownership(ticker: str):
    return await get_ownership(ticker.upper())

@router.get("/{ticker}/dividends")
async def dividends(ticker: str):
    return await get_dividends(ticker.upper())
```

- [ ] **Step 6: Register router in `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import market, financials, ratios, ownership

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(financials.router)
app.include_router(ratios.router)
app.include_router(ownership.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Run all tests**

```bash
pytest tests/ -v
```

Expected: 11 passed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/ownership_service.py backend/app/routers/ownership.py backend/app/main.py backend/tests/test_ownership.py
git commit -m "feat: ownership and dividends service"
```

---

## Task 8: Backend — News Service

**Files:**
- Create: `backend/app/services/news_service.py`
- Create: `backend/app/routers/news.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write `backend/app/services/news_service.py`**

```python
import asyncio
from datetime import datetime
import yfinance as yf
from app.models.schemas import NewsResponse, NewsItem


async def get_news(ticker: str) -> NewsResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    raw_news = t.news or []
    items: list[NewsItem] = []

    for article in raw_news[:30]:   # cap at 30 items
        published_at = datetime.fromtimestamp(
            article.get("providerPublishTime", 0)
        ).isoformat()

        items.append(NewsItem(
            title=article.get("title", ""),
            publisher=article.get("publisher", ""),
            link=article.get("link", ""),
            published_at=published_at,
            summary=article.get("summary"),
        ))

    return NewsResponse(ticker=ticker.upper(), items=items)
```

- [ ] **Step 2: Write `backend/app/routers/news.py`**

```python
from fastapi import APIRouter
from app.services.news_service import get_news

router = APIRouter(prefix="/api/news", tags=["news"])

@router.get("/{ticker}")
async def news(ticker: str):
    return await get_news(ticker.upper())
```

- [ ] **Step 3: Register router in `backend/app/main.py`** (final version)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import market, financials, ratios, ownership, news

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(financials.router)
app.include_router(ratios.router)
app.include_router(ownership.router)
app.include_router(news.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Verify all 11 prior tests still pass**

```bash
cd backend
pytest tests/ -v
```

Expected: 11 passed.

- [ ] **Step 5: Smoke-test the news endpoint against a live ticker**

```bash
uvicorn app.main:app --reload --port 8000
# Second terminal:
curl http://localhost:8000/api/news/AAPL | python -m json.tool | head -40
```

Expected: JSON object with `ticker: "AAPL"` and `items` array with `title`, `publisher`, `link`. Stop uvicorn.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/news_service.py backend/app/routers/news.py backend/app/main.py
git commit -m "feat: news aggregation service from yfinance"
```

---

## Task 9: Frontend — Types, API Client, and Zustand Store

**Files:**
- Create: `frontend/src/types/financial.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/store/tickerStore.ts`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Write `frontend/src/types/financial.ts`**

```typescript
export interface MarketSnapshot {
  ticker: string;
  price: number;
  market_cap: number;
  enterprise_value: number;
  shares_outstanding: number;
  total_debt: number;
  cash: number;
}

export interface QuarterlyEPS {
  period: string;
  eps_actual: number | null;
  eps_estimate: number | null;
  eps_yoy_delta_pct: number | null;
}

export interface QuarterlyRevenue {
  period: string;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  revenue_yoy_delta_pct: number | null;
}

export interface EPSRevenueResponse {
  ticker: string;
  quarterly_eps: QuarterlyEPS[];
  quarterly_revenue: QuarterlyRevenue[];
}

export interface QuarterlyCash {
  period: string;
  cash: number;
  short_term_investments: number;
  total_liquid: number;
}

export interface CashResponse {
  ticker: string;
  quarterly: QuarterlyCash[];
}

export interface AnnualBacklog {
  year: number;
  revenue: number;
}

export interface OrderBacklogResponse {
  ticker: string;
  annual: AnnualBacklog[];
  note: string;
}

export interface RatioWithBenchmark {
  name: string;
  value: number | null;
  sector_average: number | null;
  unit: string;
}

export interface HistoricalRatio {
  year: number;
  p_fcf: number | null;
  d_e: number | null;
}

export interface RatiosResponse {
  ticker: string;
  current: RatioWithBenchmark[];
  historical: HistoricalRatio[];
}

export interface OwnershipRecord {
  holder: string;
  shares: number;
  pct_out: number;
  holder_type: string;
}

export interface OwnershipResponse {
  ticker: string;
  insider_pct: number;
  institutional_pct: number;
  top_holders: OwnershipRecord[];
}

export interface DividendRecord {
  date: string;
  amount: number;
  yield_pct: number | null;
  ex_date: string | null;
  declaration_date: string | null;
}

export interface DividendResponse {
  ticker: string;
  dividends: DividendRecord[];
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  published_at: string;
  summary: string | null;
}

export interface NewsResponse {
  ticker: string;
  items: NewsItem[];
}
```

- [ ] **Step 2: Write `frontend/src/lib/api.ts`**

```typescript
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
  const ws = new WebSocket(`${wsUrl}/ws/market/${ticker}`);
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as MarketSnapshot);
    } catch {
      // ignore malformed frames
    }
  };
  return ws;
}
```

- [ ] **Step 3: Write `frontend/src/store/tickerStore.ts`**

```typescript
import { create } from "zustand";

interface TickerState {
  ticker: string;
  setTicker: (ticker: string) => void;
}

export const useTickerStore = create<TickerState>((set) => ({
  ticker: "AAPL",
  setTicker: (ticker) => set({ ticker: ticker.toUpperCase().trim() }),
}));
```

- [ ] **Step 4: Update `frontend/src/app/layout.tsx` to add QueryClient provider**

```tsx
"use client";

import type { Metadata } from "next";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// Metadata must be in a server component — move to a server wrapper
// For now, define it here for simplicity (works when not using "use client" at root)
// The provider needs "use client", so we wrap children in a client boundary.

function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,    // 30 seconds
        refetchOnWindowFocus: false,
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/ frontend/src/lib/ frontend/src/store/ frontend/src/app/layout.tsx
git commit -m "feat: frontend types, API client, and Zustand ticker store"
```

---

## Task 10: Frontend — Dashboard Layout and TickerSearch

**Files:**
- Create: `frontend/src/components/layout/DashboardLayout.tsx`
- Create: `frontend/src/components/layout/TickerSearch.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Write `frontend/src/components/layout/TickerSearch.tsx`**

```tsx
"use client";

import { useState, FormEvent } from "react";
import { useTickerStore } from "@/store/tickerStore";

export function TickerSearch() {
  const { ticker, setTicker } = useTickerStore();
  const [input, setInput] = useState(ticker);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed.length > 0) setTicker(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label htmlFor="ticker-input" className="text-sm text-gray-400 font-medium">
        Ticker
      </label>
      <input
        id="ticker-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        placeholder="AAPL"
        maxLength={10}
        className="w-28 px-3 py-1.5 rounded bg-gray-800 border border-gray-600
                   text-white placeholder-gray-500 text-sm font-mono
                   focus:outline-none focus:border-blue-500 uppercase"
      />
      <button
        type="submit"
        className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500
                   text-white font-medium transition-colors"
      >
        Load
      </button>
      <span className="text-xs text-gray-500 ml-2">
        Active: <span className="text-blue-400 font-mono">{ticker}</span>
      </span>
    </form>
  );
}
```

- [ ] **Step 2: Write `frontend/src/components/layout/DashboardLayout.tsx`**

```tsx
import { ReactNode } from "react";
import { TickerSearch } from "./TickerSearch";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Financial Dashboard</h1>
          <p className="text-xs text-gray-500">Fundamental Analysis</p>
        </div>
        <TickerSearch />
      </header>

      {/* Main content grid */}
      <main className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update `frontend/src/app/page.tsx` to use the layout**

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="xl:col-span-12 text-center text-gray-500 py-20">
        Modules loading...
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 4: Start the dev server and verify the layout**

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. Expected: Dark header with "Financial Dashboard" title and a ticker search input pre-filled with "AAPL". Typing a ticker and clicking "Load" updates the "Active:" indicator. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/ frontend/src/app/page.tsx
git commit -m "feat: dashboard layout shell with ticker search"
```

---

## Task 11: Frontend — Shared Components (DataTable + ChartWrapper)

**Files:**
- Create: `frontend/src/components/shared/DataTable.tsx`
- Create: `frontend/src/components/shared/ChartWrapper.tsx`

- [ ] **Step 1: Write `frontend/src/components/shared/DataTable.tsx`**

This table supports CSV/Excel export via the `xlsx` library.

```tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface Column<T> {
  key: keyof T;
  label: string;
  format?: (val: T[keyof T]) => string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  exportFilename?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  title,
  exportFilename = "export",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortAsc
          ? av < bv ? -1 : av > bv ? 1 : 0
          : av > bv ? -1 : av < bv ? 1 : 0;
      })
    : data;

  function exportCSV() {
    const rows = sorted.map((row) =>
      Object.fromEntries(
        columns.map((col) => [
          col.label,
          col.format ? col.format(row[col.key]) : String(row[col.key] ?? ""),
        ])
      )
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `${exportFilename}.xlsx`);
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            onClick={exportCSV}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Export XLSX
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-left cursor-pointer hover:text-gray-200 select-none"
                >
                  {col.label}
                  {sortKey === col.key ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                className="border-t border-gray-800 hover:bg-gray-800 transition-colors"
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-2 text-gray-200">
                    {col.format
                      ? col.format(row[col.key])
                      : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/src/components/shared/ChartWrapper.tsx`**

This wraps any Recharts chart with a title, loading/error states, and responsive container.

```tsx
"use client";

import { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  height?: number;
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
}

export function ChartWrapper({
  title,
  subtitle,
  height = 280,
  children,
  isLoading = false,
  error = null,
}: ChartWrapperProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      {isLoading && (
        <div
          className="flex items-center justify-center text-gray-500 text-sm"
          style={{ height }}
        >
          Loading...
        </div>
      )}

      {error && (
        <div
          className="flex items-center justify-center text-red-400 text-sm"
          style={{ height }}
        >
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <ResponsiveContainer width="100%" height={height}>
          {/* children must be a single Recharts chart element */}
          {children as React.ReactElement}
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/
git commit -m "feat: shared DataTable with XLSX export and ChartWrapper"
```

---

## Task 12: Frontend — MarketPerformanceCard (Real-Time WebSocket)

**Files:**
- Create: `frontend/src/hooks/useMarketSocket.ts`
- Create: `frontend/src/components/market/MarketPerformanceCard.tsx`

- [ ] **Step 1: Write `frontend/src/hooks/useMarketSocket.ts`**

```typescript
"use client";

import { useEffect, useState, useRef } from "react";
import { createMarketWebSocket } from "@/lib/api";
import type { MarketSnapshot } from "@/types/financial";

export function useMarketSocket(ticker: string) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Close previous connection
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
```

- [ ] **Step 2: Write `frontend/src/components/market/MarketPerformanceCard.tsx`**

```tsx
"use client";

import { useTickerStore } from "@/store/tickerStore";
import { useMarketSocket } from "@/hooks/useMarketSocket";

function fmt(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

export function MarketPerformanceCard() {
  const ticker = useTickerStore((s) => s.ticker);
  const { snapshot, connected } = useMarketSocket(ticker);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-2xl font-bold font-mono text-white">{ticker}</span>
          {snapshot && (
            <span className="ml-3 text-xl text-blue-300 font-mono">
              ${snapshot.price.toFixed(2)}
            </span>
          )}
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            connected
              ? "bg-green-900 text-green-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          {connected ? "LIVE" : "Connecting…"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Market Cap</p>
          <p className="text-lg font-semibold text-white">
            {fmt(snapshot?.market_cap)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Enterprise Value</p>
          <p className="text-lg font-semibold text-white">
            {fmt(snapshot?.enterprise_value)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total Debt</p>
          <p className="text-base font-medium text-gray-200">
            {fmt(snapshot?.total_debt)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Cash & Equivalents</p>
          <p className="text-base font-medium text-gray-200">
            {fmt(snapshot?.cash)}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Add MarketPerformanceCard to the dashboard page to test it**

Edit `frontend/src/app/page.tsx`:

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 5: Start both servers and test the live feed**

Terminal 1 (backend):
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. Expected: MarketPerformanceCard shows AAPL price, Market Cap, and Enterprise Value updating every 3 seconds. The green "LIVE" badge appears. Change ticker to "MSFT" and click Load — card reconnects and shows MSFT data within 3 seconds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useMarketSocket.ts frontend/src/components/market/ frontend/src/app/page.tsx
git commit -m "feat: real-time market performance card via WebSocket"
```

---

## Task 13: Frontend — EPS & Revenue Chart

**Files:**
- Create: `frontend/src/hooks/useFinancials.ts`
- Create: `frontend/src/components/financials/EPSRevenueChart.tsx`

- [ ] **Step 1: Write `frontend/src/hooks/useFinancials.ts`**

```typescript
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
```

- [ ] **Step 2: Write `frontend/src/components/financials/EPSRevenueChart.tsx`**

```tsx
"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useEPSRevenue } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";

function fmtRev(v: number | null) {
  if (v == null) return "—";
  return `$${(v / 1e9).toFixed(1)}B`;
}

function fmtEPS(v: number | null) {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}

function fmtDelta(v: number | null) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function EPSRevenueChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useEPSRevenue(ticker);

  // Merge EPS and Revenue into one array keyed by period
  const chartData = (data?.quarterly_revenue ?? []).map((rev, i) => {
    const eps = data?.quarterly_eps[i];
    return {
      period: rev.period,
      revenue_b: rev.revenue_actual != null ? rev.revenue_actual / 1e9 : null,
      eps: eps?.eps_actual ?? null,
    };
  });

  const tableData = (data?.quarterly_revenue ?? []).map((rev, i) => {
    const eps = data?.quarterly_eps[i];
    return {
      period: rev.period,
      revenue_actual: rev.revenue_actual,
      revenue_yoy: rev.revenue_yoy_delta_pct,
      eps_actual: eps?.eps_actual ?? null,
      eps_yoy: eps?.eps_yoy_delta_pct ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <ChartWrapper
        title="EPS & Revenue — Quarterly"
        subtitle="Last 5 years | Bars = Revenue ($B), Line = EPS ($)"
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="period" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis
            yAxisId="left"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            label={{ value: "Revenue ($B)", angle: -90, fill: "#9ca3af", fontSize: 10, dx: -10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            label={{ value: "EPS ($)", angle: 90, fill: "#9ca3af", fontSize: 10, dx: 10 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            labelStyle={{ color: "#f9fafb" }}
            formatter={(value: number, name: string) =>
              name === "revenue_b" ? [`$${value.toFixed(1)}B`, "Revenue"] : [`$${value.toFixed(2)}`, "EPS"]
            }
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar yAxisId="left" dataKey="revenue_b" name="Revenue" fill="#3b82f6" opacity={0.8} />
          <Line yAxisId="right" type="monotone" dataKey="eps" name="EPS" stroke="#10b981" dot={{ r: 2 }} strokeWidth={2} />
        </ComposedChart>
      </ChartWrapper>

      <DataTable
        title="EPS & Revenue Detail"
        exportFilename={`${ticker}-eps-revenue`}
        data={tableData}
        columns={[
          { key: "period", label: "Period" },
          { key: "revenue_actual", label: "Revenue", format: (v) => fmtRev(v as number | null) },
          { key: "revenue_yoy", label: "Rev YoY", format: (v) => fmtDelta(v as number | null) },
          { key: "eps_actual", label: "EPS", format: (v) => fmtEPS(v as number | null) },
          { key: "eps_yoy", label: "EPS YoY", format: (v) => fmtDelta(v as number | null) },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add EPSRevenueChart to the dashboard page**

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";
import { EPSRevenueChart } from "@/components/financials/EPSRevenueChart";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
      <div className="xl:col-span-8">
        <EPSRevenueChart />
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 4: Test in browser**

With both servers running, open `http://localhost:3000`. Expected: Combo chart appears showing quarterly Revenue bars and EPS line for AAPL. Table below shows the same data with YoY deltas. Switching ticker updates both chart and table.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useFinancials.ts frontend/src/components/financials/EPSRevenueChart.tsx frontend/src/app/page.tsx
git commit -m "feat: EPS and revenue combo chart with quarterly table"
```

---

## Task 14: Frontend — Cash Chart & Order Backlog Chart

**Files:**
- Create: `frontend/src/components/financials/CashChart.tsx`
- Create: `frontend/src/components/financials/OrderBacklogChart.tsx`

- [ ] **Step 1: Write `frontend/src/components/financials/CashChart.tsx`**

```tsx
"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useCash } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";

export function CashChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useCash(ticker);

  const chartData = (data?.quarterly ?? []).map((q) => ({
    period: q.period,
    cash_b: q.cash / 1e9,
    investments_b: q.short_term_investments / 1e9,
    total_b: q.total_liquid / 1e9,
  }));

  return (
    <ChartWrapper
      title="Cash & Liquid Assets — Quarterly"
      subtitle="Cash, short-term investments, and Treasury bills ($B)"
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="period" tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
          formatter={(v: number, name: string) => [`$${v.toFixed(1)}B`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
        <Area type="monotone" dataKey="cash_b" name="Cash" stroke="#3b82f6" fill="url(#cashGrad)" />
        <Area type="monotone" dataKey="investments_b" name="Short-Term Investments" stroke="#10b981" fill="url(#invGrad)" />
      </AreaChart>
    </ChartWrapper>
  );
}
```

- [ ] **Step 2: Write `frontend/src/components/financials/OrderBacklogChart.tsx`**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useOrderBacklog } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";

export function OrderBacklogChart() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useOrderBacklog(ticker);

  const chartData = (data?.annual ?? []).map((a) => ({
    year: String(a.year),
    revenue_b: a.revenue / 1e9,
  }));

  return (
    <ChartWrapper
      title="Annual Revenue / Order Backlog Proxy"
      subtitle={data?.note ?? ""}
      isLoading={isLoading}
      error={error ? String(error) : null}
    >
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
          formatter={(v: number) => [`$${v.toFixed(1)}B`, "Revenue"]}
        />
        <Bar dataKey="revenue_b" name="Revenue ($B)" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={`hsl(${210 + i * 15}, 70%, 55%)`} />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}
```

- [ ] **Step 3: Add both charts to the dashboard page**

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";
import { EPSRevenueChart } from "@/components/financials/EPSRevenueChart";
import { CashChart } from "@/components/financials/CashChart";
import { OrderBacklogChart } from "@/components/financials/OrderBacklogChart";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
      <div className="xl:col-span-8">
        <EPSRevenueChart />
      </div>
      <div className="xl:col-span-6">
        <CashChart />
      </div>
      <div className="xl:col-span-6">
        <OrderBacklogChart />
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 4: Test in browser — both charts render with area and bar charts respectively**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/financials/CashChart.tsx frontend/src/components/financials/OrderBacklogChart.tsx frontend/src/app/page.tsx
git commit -m "feat: cash area chart and order backlog bar chart"
```

---

## Task 15: Frontend — Ratios Module

**Files:**
- Create: `frontend/src/components/ratios/RatiosModule.tsx`

- [ ] **Step 1: Write `frontend/src/components/ratios/RatiosModule.tsx`**

```tsx
"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useRatios } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";

export function RatiosModule() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data, isLoading, error } = useRatios(ticker);

  const benchmarkChartData = (data?.current ?? []).map((r) => ({
    name: r.name,
    value: r.value ?? 0,
    sector: r.sector_average ?? 0,
  }));

  const historicalChartData = (data?.historical ?? []).map((h) => ({
    year: String(h.year),
    p_fcf: h.p_fcf ?? 0,
    d_e: h.d_e ?? 0,
  }));

  return (
    <div className="space-y-4">
      <ChartWrapper
        title="Valuation Ratios vs Sector Average"
        subtitle="P/E, P/B, EV/EBITDA, P/FCF, D/E — company vs sector median"
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <BarChart data={benchmarkChartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(v: number, name: string) => [`${v.toFixed(1)}x`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar dataKey="value" name={ticker} fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="sector" name="Sector Avg" fill="#6b7280" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartWrapper>

      <ChartWrapper
        title="P/FCF & D/E — 5-Year Historical"
        subtitle="Price-to-Free-Cash-Flow and Debt-to-Equity trend"
        isLoading={isLoading}
        error={error ? String(error) : null}
      >
        <BarChart data={historicalChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(v: number, name: string) => [`${v.toFixed(1)}x`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          <Bar dataKey="p_fcf" name="P/FCF" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="d_e" name="D/E" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartWrapper>

      <DataTable
        title="Current Ratios"
        exportFilename={`${ticker}-ratios`}
        data={(data?.current ?? []).map((r) => ({
          name: r.name,
          value: r.value,
          sector_average: r.sector_average,
          vs_sector: r.value != null && r.sector_average != null
            ? `${((r.value / r.sector_average - 1) * 100).toFixed(1)}%`
            : "—",
        }))}
        columns={[
          { key: "name", label: "Ratio" },
          { key: "value", label: "Current", format: (v) => v != null ? `${(v as number).toFixed(1)}x` : "—" },
          { key: "sector_average", label: "Sector Avg", format: (v) => v != null ? `${(v as number).toFixed(1)}x` : "—" },
          { key: "vs_sector", label: "vs Sector" },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add RatiosModule to the dashboard page**

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";
import { EPSRevenueChart } from "@/components/financials/EPSRevenueChart";
import { CashChart } from "@/components/financials/CashChart";
import { OrderBacklogChart } from "@/components/financials/OrderBacklogChart";
import { RatiosModule } from "@/components/ratios/RatiosModule";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
      <div className="xl:col-span-8">
        <EPSRevenueChart />
      </div>
      <div className="xl:col-span-6">
        <CashChart />
      </div>
      <div className="xl:col-span-6">
        <OrderBacklogChart />
      </div>
      <div className="xl:col-span-12">
        <RatiosModule />
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 3: Test in browser — verify horizontal bar chart shows company vs sector benchmarks**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ratios/ frontend/src/app/page.tsx
git commit -m "feat: ratios module with benchmark comparison and 5-year historical trend"
```

---

## Task 16: Frontend — Ownership & Dividends Module

**Files:**
- Create: `frontend/src/components/ownership/OwnershipModule.tsx`

- [ ] **Step 1: Write `frontend/src/components/ownership/OwnershipModule.tsx`**

```tsx
"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { useTickerStore } from "@/store/tickerStore";
import { useOwnership, useDividends } from "@/hooks/useFinancials";
import { ChartWrapper } from "@/components/shared/ChartWrapper";
import { DataTable } from "@/components/shared/DataTable";

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#14b8a6"];

export function OwnershipModule() {
  const ticker = useTickerStore((s) => s.ticker);
  const { data: ownership, isLoading: ownerLoading, error: ownerError } = useOwnership(ticker);
  const { data: dividends, isLoading: divLoading, error: divError } = useDividends(ticker);

  const pieData = [
    { name: "Insider", value: ownership?.insider_pct ?? 0 },
    { name: "Institutional", value: ownership?.institutional_pct ?? 0 },
    { name: "Other", value: Math.max(0, 100 - (ownership?.insider_pct ?? 0) - (ownership?.institutional_pct ?? 0)) },
  ];

  const divChartData = (dividends?.dividends ?? []).slice(-20).map((d) => ({
    date: d.date.slice(0, 7),   // YYYY-MM
    amount: d.amount,
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Ownership Pie */}
      <ChartWrapper
        title="Ownership Structure"
        subtitle="Insider vs Institutional vs Other"
        height={240}
        isLoading={ownerLoading}
        error={ownerError ? String(ownerError) : null}
      >
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={90}
            dataKey="value"
            label={({ name, value }) => `${name}: ${(value as number).toFixed(1)}%`}
            labelLine={false}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
        </PieChart>
      </ChartWrapper>

      {/* Top Holders Table */}
      <DataTable
        title="Top Institutional Holders"
        exportFilename={`${ticker}-ownership`}
        data={(ownership?.top_holders ?? []).map((h) => ({
          holder: h.holder,
          pct_out: h.pct_out,
          shares_m: h.shares / 1e6,
        }))}
        columns={[
          { key: "holder", label: "Holder" },
          { key: "pct_out", label: "% Outstanding", format: (v) => `${(v as number).toFixed(2)}%` },
          { key: "shares_m", label: "Shares (M)", format: (v) => `${(v as number).toFixed(1)}M` },
        ]}
      />

      {/* Dividend Chart */}
      <ChartWrapper
        title="Dividend Payment History"
        subtitle="Per-share dividend amount over time"
        isLoading={divLoading}
        error={divError ? String(divError) : null}
      >
        <BarChart data={divChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 9 }} interval={3} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 6 }}
            formatter={(v: number) => [`$${v.toFixed(4)}`, "Dividend"]}
          />
          <Bar dataKey="amount" name="Dividend/Share" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartWrapper>

      {/* Dividend Table */}
      <DataTable
        title="Dividend Details"
        exportFilename={`${ticker}-dividends`}
        data={(dividends?.dividends ?? []).slice(-20).reverse().map((d) => ({
          date: d.date,
          amount: d.amount,
          yield_pct: d.yield_pct,
        }))}
        columns={[
          { key: "date", label: "Date" },
          { key: "amount", label: "Amount/Share", format: (v) => `$${(v as number).toFixed(4)}` },
          { key: "yield_pct", label: "Annual Yield", format: (v) => v != null ? `${(v as number).toFixed(2)}%` : "—" },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add OwnershipModule to the dashboard page**

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";
import { EPSRevenueChart } from "@/components/financials/EPSRevenueChart";
import { CashChart } from "@/components/financials/CashChart";
import { OrderBacklogChart } from "@/components/financials/OrderBacklogChart";
import { RatiosModule } from "@/components/ratios/RatiosModule";
import { OwnershipModule } from "@/components/ownership/OwnershipModule";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
      <div className="xl:col-span-8">
        <EPSRevenueChart />
      </div>
      <div className="xl:col-span-6">
        <CashChart />
      </div>
      <div className="xl:col-span-6">
        <OrderBacklogChart />
      </div>
      <div className="xl:col-span-12">
        <RatiosModule />
      </div>
      <div className="xl:col-span-12">
        <OwnershipModule />
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 3: Test in browser — pie chart + holder table + dividend chart and table all render**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ownership/ frontend/src/app/page.tsx
git commit -m "feat: ownership pie chart, institutional holder table, and dividend history"
```

---

## Task 17: Frontend — News Feed

**Files:**
- Create: `frontend/src/components/news/NewsFeed.tsx`

- [ ] **Step 1: Write `frontend/src/components/news/NewsFeed.tsx`**

```tsx
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
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">
          News — <span className="text-blue-400 font-mono">{ticker}</span>
        </h3>
      </div>

      {isLoading && (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">Loading news…</div>
      )}

      {error && (
        <div className="px-4 py-8 text-center text-red-400 text-sm">Failed to load news.</div>
      )}

      {!isLoading && !error && (
        <div className="divide-y divide-gray-800 max-h-[480px] overflow-y-auto">
          {(data?.items ?? []).map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-gray-800 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 group-hover:text-white leading-snug line-clamp-2">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.summary}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-blue-400 font-medium">{item.publisher}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{timeAgo(item.published_at)}</p>
                </div>
              </div>
            </a>
          ))}
          {(data?.items ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No news available for {ticker}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire all modules into the final dashboard page**

Write the final version of `frontend/src/app/page.tsx`:

```tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarketPerformanceCard } from "@/components/market/MarketPerformanceCard";
import { EPSRevenueChart } from "@/components/financials/EPSRevenueChart";
import { CashChart } from "@/components/financials/CashChart";
import { OrderBacklogChart } from "@/components/financials/OrderBacklogChart";
import { RatiosModule } from "@/components/ratios/RatiosModule";
import { OwnershipModule } from "@/components/ownership/OwnershipModule";
import { NewsFeed } from "@/components/news/NewsFeed";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      {/* Row 1: Market snapshot + EPS/Revenue */}
      <div className="xl:col-span-4">
        <MarketPerformanceCard />
      </div>
      <div className="xl:col-span-8">
        <EPSRevenueChart />
      </div>

      {/* Row 2: Cash trend + Order Backlog */}
      <div className="xl:col-span-6">
        <CashChart />
      </div>
      <div className="xl:col-span-6">
        <OrderBacklogChart />
      </div>

      {/* Row 3: Ratios */}
      <div className="xl:col-span-12">
        <RatiosModule />
      </div>

      {/* Row 4: Ownership + News */}
      <div className="xl:col-span-8">
        <OwnershipModule />
      </div>
      <div className="xl:col-span-4">
        <NewsFeed />
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 3: Full end-to-end test**

Start both servers:

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:3000`. Check:

1. Ticker defaults to "AAPL" and all panels load data.
2. Live MC/EV card shows "LIVE" and updates every 3 seconds.
3. EPS/Revenue combo chart renders with bars and a line.
4. Cash area chart renders.
5. Order backlog bar chart renders with the proxy note.
6. Ratios horizontal bar chart shows company vs sector.
7. Ownership pie chart + holder table render.
8. Dividend bar chart renders.
9. News feed shows article cards with publisher + time.
10. Typing "MSFT" and clicking Load causes ALL panels to reload with Microsoft data within 1.5 seconds.
11. Click "Export XLSX" on any table — an `.xlsx` file downloads.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/news/ frontend/src/app/page.tsx
git commit -m "feat: news feed and complete dashboard assembly"
```

---

## Task 18: Frontend — TypeScript Build Pass + Production Readiness

**Files:**
- Create: `frontend/.env.local`
- Modify: `backend/.env` (optional)

- [ ] **Step 1: Create `frontend/.env.local`**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 2: Run TypeScript full check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors. Fix any remaining type errors before proceeding.

- [ ] **Step 3: Run the Next.js production build**

```bash
npm run build
```

Expected: Build completes with no errors. Pages compile. Any "use client" boundary warnings are acceptable — type errors are not.

- [ ] **Step 4: Run the full backend test suite one final time**

```bash
cd ../backend
pytest tests/ -v
```

Expected: 11 passed, 0 failed.

- [ ] **Step 5: Final commit**

```bash
cd ..
git add frontend/.env.local
git commit -m "chore: add env config and verify production build passes"
```

---

## Self-Review Against SRS

### 1. Spec Coverage

| SRS Requirement | Task |
|---|---|
| Market Cap + EV real-time | Task 4 (backend), Task 12 (frontend) |
| EPS + Revenue, forecast vs actual, YoY delta | Task 5, Task 13 |
| Cash & Cash Equivalents quarterly | Task 5, Task 14 |
| Order Backlog with planning horizon | Task 5, Task 14 (revenue proxy + note) |
| P/E, P/B, EV/EBITDA, P/FCF, D/E + sector avg | Task 6, Task 15 |
| Insider + Institutional Ownership | Task 7, Task 16 |
| Dividend policy table + 5-year chart | Task 7, Task 16 |
| News aggregator (ticker-based) | Task 8, Task 17 |
| All charts: Zoom + Tooltip | ChartWrapper uses Recharts built-in zoom/tooltip |
| Table CSV/Excel export | Task 11 (DataTable) |
| Ticker switch syncs all modules | Tasks 9, 12-17 (Zustand + TanStack Query) |
| Dashboard response < 1.5s on ticker switch | TanStack Query parallel fetching; yfinance is the bottleneck |
| 1920x1080+ and tablet responsive | Tailwind responsive grid (`xl:col-span-*`) |

**Gap — Order Backlog forecast years ahead:** The SRS requests "planning horizon for several years ahead" on the backlog chart. yfinance doesn't expose analyst revenue forecasts freely. This is implemented as a proxy (historical revenue) with a note. To fully close this gap, integrate a paid data source (e.g., Alpha Vantage Premium `EARNINGS` endpoint) and add forecast bars with a different color/opacity to `OrderBacklogChart`.

**Gap — EPS/Revenue analyst estimates:** `eps_estimate` and `revenue_estimate` fields exist in the schema but are `null` since yfinance free tier doesn't provide them. To enable, integrate Alpha Vantage `EARNINGS` API or Polygon.io.

### 2. Placeholder Scan

No TBD/TODO/implement later found in any task — all steps have concrete code.

### 3. Type Consistency Check

- `MarketSnapshot` defined in Task 3 → used in Task 4 service, Task 9 types, Task 12 hook. All match.
- `EPSRevenueResponse.quarterly_eps` / `quarterly_revenue` defined in Task 3 → accessed in Task 13 as `data?.quarterly_eps` / `data?.quarterly_revenue`. Match.
- `RatiosResponse.current` / `historical` defined in Task 3 → accessed in Task 15 as `data?.current` / `data?.historical`. Match.
- `OwnershipResponse.top_holders` defined in Task 3 → accessed in Task 16 as `ownership?.top_holders`. Match.
- `DividendResponse.dividends` defined in Task 3 → accessed in Task 16 as `dividends?.dividends`. Match.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-12-financial-dashboard.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
