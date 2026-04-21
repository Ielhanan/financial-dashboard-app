# FMP Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all yfinance data fetching with the Financial Modeling Prep (FMP) REST API so the backend no longer depends on scraped Yahoo Finance endpoints.

**Architecture:** A single `fmp_client.py` module owns all FMP HTTP calls and an in-process per-endpoint cache (5 min for quotes, 1 hr for ratios/holders, 24 hr for statements). The five service files keep all their business logic and are updated only at their data-access lines. Routers, schemas, and the frontend are untouched.

**Tech Stack:** Python 3.11, FastAPI, httpx (already in requirements), pydantic-settings, pytest-asyncio

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `backend/app/config.py` | Add `financial_api_key` setting |
| **Create** | `backend/app/services/fmp_client.py` | All FMP HTTP calls + in-process cache |
| Modify | `backend/app/services/market_service.py` | Use fmp_client instead of ticker_cache |
| Modify | `backend/app/services/financials_service.py` | Use fmp_client instead of ticker_cache |
| Modify | `backend/app/services/ratios_service.py` | Use fmp_client instead of ticker_cache |
| Modify | `backend/app/services/ownership_service.py` | Use fmp_client instead of ticker_cache |
| Modify | `backend/app/services/news_service.py` | Use fmp_client instead of ticker_cache |
| Modify | `backend/tests/test_market.py` | Mock fmp_client functions |
| Modify | `backend/tests/test_financials.py` | Mock fmp_client functions |
| Modify | `backend/tests/test_ratios.py` | Mock fmp_client functions |
| Modify | `backend/tests/test_ownership.py` | Mock fmp_client functions |
| Modify | `backend/tests/test_news.py` | Mock fmp_client functions |
| Delete | `backend/app/services/ticker_cache.py` | Replaced by fmp_client |
| Modify | `backend/requirements.txt` | Remove yfinance |

---

## Task 1: Update config.py

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add `financial_api_key` to Settings**

Replace the entire file with:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:3000"]
    ws_update_interval_seconds: float = 3.0
    financial_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 2: Verify import works**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.config import settings; print(settings.financial_api_key)"
```

Expected: prints empty string (or your key if set in `.env`)

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "feat: add financial_api_key to config"
```

---

## Task 2: Create fmp_client.py

**Files:**
- Create: `backend/app/services/fmp_client.py`

- [ ] **Step 1: Create the file**

```python
"""
FMP (Financial Modeling Prep) API client with in-process per-endpoint caching.

Cache keys are (ticker, endpoint_name) tuples.
Each (ticker, endpoint) pair has its own asyncio.Lock so concurrent requests
for different endpoints on the same ticker proceed in parallel while duplicate
requests for the same endpoint are collapsed to one HTTP call.
"""
import asyncio
import time
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://financialmodelingprep.com/api/v3"

# TTLs in seconds
_TTL_QUOTE = 300        # 5 min  — price / market cap
_TTL_RATIOS = 3600      # 1 hr   — key metrics, holders
_TTL_STMTS = 86400      # 24 hr  — income / balance / cash-flow statements
_TTL_NEWS = 1800        # 30 min — news feed

# In-process cache: (ticker, endpoint) → (data, fetched_at_monotonic)
_cache: dict[tuple[str, str], tuple[Any, float]] = {}
_locks: dict[str, asyncio.Lock] = {}


def _get_lock(ticker: str, endpoint: str) -> asyncio.Lock:
    key = f"{ticker}:{endpoint}"
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


async def _fetch(path: str, params: dict | None = None) -> Any:
    """Single GET to FMP. Returns parsed JSON or None on any error."""
    full_params: dict[str, Any] = {"apikey": settings.financial_api_key}
    if params:
        full_params.update(params)
    try:
        async with httpx.AsyncClient(base_url=_BASE_URL, timeout=10.0) as client:
            resp = await client.get(path, params=full_params)
        if resp.status_code == 429:
            logger.warning("FMP rate limit (429): %s", path)
            return None
        if resp.status_code == 403:
            logger.info("FMP plan restriction (403): %s", path)
            return None
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("FMP request failed for %s: %s", path, exc)
        return None


async def _cached(
    ticker: str,
    endpoint: str,
    path: str,
    ttl: float,
    params: dict | None = None,
) -> Any:
    """Fetch with caching and per-(ticker, endpoint) locking."""
    cache_key = (ticker, endpoint)
    async with _get_lock(ticker, endpoint):
        now = time.monotonic()
        if cache_key in _cache:
            data, fetched_at = _cache[cache_key]
            if now - fetched_at < ttl:
                return data
        fresh = await _fetch(path, params)
        if fresh is not None:
            _cache[cache_key] = (fresh, time.monotonic())
            return fresh
        # Return stale value rather than crashing if fetch failed
        if cache_key in _cache:
            logger.warning("FMP fetch failed, serving stale cache for %s/%s", ticker, endpoint)
            return _cache[cache_key][0]
        return None


# ---------------------------------------------------------------------------
# Public endpoint functions
# ---------------------------------------------------------------------------

async def get_quote(ticker: str) -> dict:
    """GET /quote/{ticker} — price, marketCap, sharesOutstanding."""
    data = await _cached(ticker, "quote", f"/quote/{ticker}", _TTL_QUOTE)
    if isinstance(data, list) and data:
        return data[0]
    return {}


async def get_profile(ticker: str) -> dict:
    """GET /profile/{ticker} — sector, industry, companyName."""
    data = await _cached(ticker, "profile", f"/profile/{ticker}", _TTL_RATIOS)
    if isinstance(data, list) and data:
        return data[0]
    return {}


async def get_income_statements_quarterly(ticker: str) -> list[dict]:
    """GET /income-statement/{ticker}?period=quarter&limit=20"""
    data = await _cached(
        ticker, "income_q", f"/income-statement/{ticker}", _TTL_STMTS,
        {"period": "quarter", "limit": 20},
    )
    return data if isinstance(data, list) else []


async def get_income_statements_annual(ticker: str) -> list[dict]:
    """GET /income-statement/{ticker}?period=annual&limit=5"""
    data = await _cached(
        ticker, "income_a", f"/income-statement/{ticker}", _TTL_STMTS,
        {"period": "annual", "limit": 5},
    )
    return data if isinstance(data, list) else []


async def get_balance_sheets_quarterly(ticker: str) -> list[dict]:
    """GET /balance-sheet-statement/{ticker}?period=quarter&limit=20"""
    data = await _cached(
        ticker, "balance_q", f"/balance-sheet-statement/{ticker}", _TTL_STMTS,
        {"period": "quarter", "limit": 20},
    )
    return data if isinstance(data, list) else []


async def get_balance_sheets_annual(ticker: str) -> list[dict]:
    """GET /balance-sheet-statement/{ticker}?period=annual&limit=5"""
    data = await _cached(
        ticker, "balance_a", f"/balance-sheet-statement/{ticker}", _TTL_STMTS,
        {"period": "annual", "limit": 5},
    )
    return data if isinstance(data, list) else []


async def get_cash_flow_annual(ticker: str) -> list[dict]:
    """GET /cash-flow-statement/{ticker}?period=annual&limit=5"""
    data = await _cached(
        ticker, "cashflow_a", f"/cash-flow-statement/{ticker}", _TTL_STMTS,
        {"period": "annual", "limit": 5},
    )
    return data if isinstance(data, list) else []


async def get_key_metrics(ticker: str) -> dict:
    """GET /key-metrics/{ticker}?period=annual&limit=1 — peRatio, pbRatio, evToEbitda, etc."""
    data = await _cached(
        ticker, "key_metrics", f"/key-metrics/{ticker}", _TTL_RATIOS,
        {"period": "annual", "limit": 1},
    )
    if isinstance(data, list) and data:
        return data[0]
    return {}


async def get_institutional_holders(ticker: str) -> list[dict]:
    """GET /institutional-holder/{ticker} — holder, shares, sharesPercent."""
    data = await _cached(
        ticker, "inst_holders", f"/institutional-holder/{ticker}", _TTL_RATIOS,
    )
    return data if isinstance(data, list) else []


async def get_dividends(ticker: str) -> list[dict]:
    """GET /historical-price-full/stock_dividend/{ticker} — historical dividend records."""
    data = await _cached(
        ticker, "dividends",
        f"/historical-price-full/stock_dividend/{ticker}", _TTL_STMTS,
    )
    if isinstance(data, dict) and "historical" in data:
        return data["historical"]
    return []


async def get_news(ticker: str) -> list[dict]:
    """GET /stock_news?tickers={ticker}&limit=30"""
    data = await _cached(
        ticker, "news", "/stock_news", _TTL_NEWS,
        {"tickers": ticker, "limit": 30},
    )
    return data if isinstance(data, list) else []
```

- [ ] **Step 2: Verify the module imports cleanly**

```bash
cd backend && source .venv/Scripts/activate && python -c "from app.services import fmp_client; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/fmp_client.py
git commit -m "feat: add FMP API client with in-process cache"
```

---

## Task 3: market_service + test_market

**Files:**
- Modify: `backend/app/services/market_service.py`
- Modify: `backend/tests/test_market.py`

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_market.py` entirely:

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.services.market_service import get_market_snapshot
from app.models.schemas import MarketSnapshot
from app.services import fmp_client

MOCK_QUOTE = {
    "price": 175.50,
    "marketCap": 2_700_000_000_000,
    "sharesOutstanding": 15_400_000_000,
}
MOCK_KEY_METRICS = {
    "enterpriseValue": 2_735_000_000_000,
}
MOCK_BALANCE_SHEETS_Q = [
    {
        "date": "2024-03-30",
        "cashAndCashEquivalents": 73_000_000_000,
        "shortTermInvestments": 39_000_000_000,
        "totalDebt": 108_000_000_000,
    }
]


@pytest.mark.anyio
async def test_get_market_snapshot_returns_schema():
    with (
        patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=MOCK_QUOTE)),
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_SHEETS_Q)),
    ):
        result = await get_market_snapshot("AAPL")

    assert isinstance(result, MarketSnapshot)
    assert result.ticker == "AAPL"
    assert result.price == 175.50
    assert result.market_cap == 2_700_000_000_000


@pytest.mark.anyio
async def test_get_market_snapshot_uses_ev_from_key_metrics():
    with (
        patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=MOCK_QUOTE)),
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_SHEETS_Q)),
    ):
        result = await get_market_snapshot("AAPL")

    assert result.enterprise_value == 2_735_000_000_000


@pytest.mark.anyio
async def test_market_rest_endpoint(client):
    with (
        patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=MOCK_QUOTE)),
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_SHEETS_Q)),
    ):
        response = await client.get("/api/market/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["price"] == 175.50
    assert "enterprise_value" in data
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
cd backend && source .venv/Scripts/activate && pytest tests/test_market.py -v
```

Expected: 3 FAILED (service still imports ticker_cache)

- [ ] **Step 3: Rewrite market_service.py**

```python
import asyncio
import logging
from app.models.schemas import MarketSnapshot
from app.services import fmp_client

logger = logging.getLogger(__name__)


async def get_market_snapshot(ticker: str) -> MarketSnapshot:
    try:
        quote, metrics, balance_sheets = await asyncio.gather(
            fmp_client.get_quote(ticker),
            fmp_client.get_key_metrics(ticker),
            fmp_client.get_balance_sheets_quarterly(ticker),
        )

        price = float(quote.get("price") or 0.0)
        market_cap = float(quote.get("marketCap") or 0.0)
        shares = float(quote.get("sharesOutstanding") or 0.0)
        ev = float(metrics.get("enterpriseValue") or market_cap)

        latest = balance_sheets[0] if balance_sheets else {}
        total_debt = float(latest.get("totalDebt") or 0.0)
        cash = float(latest.get("cashAndCashEquivalents") or 0.0)

        return MarketSnapshot(
            ticker=ticker.upper(),
            price=price,
            market_cap=market_cap,
            enterprise_value=ev,
            shares_outstanding=shares,
            total_debt=total_debt,
            cash=cash,
        )
    except Exception as exc:
        logger.warning("market_service failed for %s: %s", ticker, exc)
        return MarketSnapshot(
            ticker=ticker.upper(),
            price=0.0, market_cap=0.0, enterprise_value=0.0,
            shares_outstanding=0.0, total_debt=0.0, cash=0.0,
        )
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
pytest tests/test_market.py -v
```

Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/market_service.py backend/tests/test_market.py
git commit -m "feat: migrate market_service to FMP"
```

---

## Task 4: financials_service + test_financials

**Files:**
- Modify: `backend/app/services/financials_service.py`
- Modify: `backend/tests/test_financials.py`

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_financials.py` entirely:

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.services.financials_service import get_eps_revenue, get_cash_data, get_order_backlog
from app.models.schemas import EPSRevenueResponse, CashResponse, OrderBacklogResponse
from app.services import fmp_client

# FMP returns newest-first; 8 quarters spanning 2 years for YoY testing
MOCK_INCOME_Q = [
    {"date": "2024-03-30", "revenue": 1.00e11, "eps": 3.0},
    {"date": "2023-12-31", "revenue": 9.9e10,  "eps": 2.8},
    {"date": "2023-09-30", "revenue": 9.8e10,  "eps": 2.5},
    {"date": "2023-06-30", "revenue": 9.7e10,  "eps": 2.2},
    {"date": "2023-03-31", "revenue": 9.6e10,  "eps": 2.9},
    {"date": "2022-12-31", "revenue": 9.5e10,  "eps": 2.6},
    {"date": "2022-09-30", "revenue": 9.4e10,  "eps": 2.3},
    {"date": "2022-06-30", "revenue": 9.3e10,  "eps": 2.0},
]

MOCK_BALANCE_Q = [
    {"date": "2024-03-30", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
    {"date": "2023-12-31", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
    {"date": "2023-09-30", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
    {"date": "2023-06-30", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
]

MOCK_INCOME_A = [
    {"date": "2023-12-31", "revenue": 3.85e11},
    {"date": "2022-12-31", "revenue": 3.75e11},
    {"date": "2021-12-31", "revenue": 3.65e11},
]


@pytest.mark.anyio
async def test_get_eps_revenue_returns_schema():
    with (
        patch.object(fmp_client, "get_income_statements_quarterly", new=AsyncMock(return_value=MOCK_INCOME_Q)),
    ):
        result = await get_eps_revenue("AAPL")
    assert isinstance(result, EPSRevenueResponse)
    assert result.ticker == "AAPL"
    assert len(result.quarterly_revenue) > 0
    assert len(result.quarterly_eps) > 0


@pytest.mark.anyio
async def test_get_cash_data_returns_schema():
    with (
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_Q)),
    ):
        result = await get_cash_data("AAPL")
    assert isinstance(result, CashResponse)
    assert all(
        abs(r.total_liquid - (r.cash + r.short_term_investments)) < 0.01
        for r in result.quarterly
    )


@pytest.mark.anyio
async def test_get_order_backlog_returns_revenue_proxy():
    with (
        patch.object(fmp_client, "get_income_statements_annual", new=AsyncMock(return_value=MOCK_INCOME_A)),
    ):
        result = await get_order_backlog("AAPL")
    assert isinstance(result, OrderBacklogResponse)
    assert len(result.annual) >= 1
    assert "proxy" in result.note.lower()


@pytest.mark.anyio
async def test_get_eps_revenue_computes_yoy_delta():
    with (
        patch.object(fmp_client, "get_income_statements_quarterly", new=AsyncMock(return_value=MOCK_INCOME_Q)),
    ):
        result = await get_eps_revenue("AAPL")
    quarters_with_delta = [q for q in result.quarterly_eps if q.eps_yoy_delta_pct is not None]
    assert len(quarters_with_delta) > 0
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
pytest tests/test_financials.py -v
```

Expected: 4 FAILED

- [ ] **Step 3: Rewrite financials_service.py**

```python
import logging
from typing import Optional
from app.models.schemas import (
    EPSRevenueResponse, QuarterlyEPS, QuarterlyRevenue,
    CashResponse, QuarterlyCash,
    OrderBacklogResponse, AnnualBacklog,
)
from app.services import fmp_client

logger = logging.getLogger(__name__)


def _fmt_period_str(date_str: str) -> str:
    """Convert FMP date string '2024-03-30' to period label '2024-Q1'."""
    try:
        year, month, _ = date_str.split("-")
        q = (int(month) - 1) // 3 + 1
        return f"{year}-Q{q}"
    except Exception:
        return date_str


def _yoy_delta(current: Optional[float], prior: Optional[float]) -> Optional[float]:
    if current is None or prior is None or prior == 0:
        return None
    return round((current - prior) / abs(prior) * 100, 2)


def _safe_float(val) -> Optional[float]:
    try:
        v = float(val)
        return v if v == v else None  # NaN check
    except (TypeError, ValueError):
        return None


async def get_eps_revenue(ticker: str) -> EPSRevenueResponse:
    try:
        return await _get_eps_revenue_inner(ticker)
    except Exception as exc:
        logger.warning("get_eps_revenue failed for %s: %s", ticker, exc)
        return EPSRevenueResponse(ticker=ticker.upper(), quarterly_eps=[], quarterly_revenue=[])


async def _get_eps_revenue_inner(ticker: str) -> EPSRevenueResponse:
    # FMP returns newest-first; reverse so index math for YoY works oldest-first
    statements = list(reversed(await fmp_client.get_income_statements_quarterly(ticker)))

    eps_records: list[QuarterlyEPS] = []
    rev_records: list[QuarterlyRevenue] = []

    for i, stmt in enumerate(statements):
        period = _fmt_period_str(stmt.get("date", ""))
        eps = _safe_float(stmt.get("eps"))
        rev = _safe_float(stmt.get("revenue"))
        prior_eps = _safe_float(statements[i - 4].get("eps")) if i >= 4 else None
        prior_rev = _safe_float(statements[i - 4].get("revenue")) if i >= 4 else None

        eps_records.append(QuarterlyEPS(
            period=period,
            eps_actual=eps,
            eps_estimate=None,
            eps_yoy_delta_pct=_yoy_delta(eps, prior_eps),
        ))
        rev_records.append(QuarterlyRevenue(
            period=period,
            revenue_actual=rev,
            revenue_estimate=None,
            revenue_yoy_delta_pct=_yoy_delta(rev, prior_rev),
        ))

    return EPSRevenueResponse(
        ticker=ticker.upper(),
        quarterly_eps=eps_records[-20:],
        quarterly_revenue=rev_records[-20:],
    )


async def get_cash_data(ticker: str) -> CashResponse:
    try:
        return await _get_cash_data_inner(ticker)
    except Exception as exc:
        logger.warning("get_cash_data failed for %s: %s", ticker, exc)
        return CashResponse(ticker=ticker.upper(), quarterly=[])


async def _get_cash_data_inner(ticker: str) -> CashResponse:
    # FMP returns newest-first; reverse for chronological display
    balance_sheets = list(reversed(await fmp_client.get_balance_sheets_quarterly(ticker)))

    records: list[QuarterlyCash] = []
    for bs in balance_sheets[-20:]:
        cash = float(bs.get("cashAndCashEquivalents") or 0.0)
        sti = float(bs.get("shortTermInvestments") or 0.0)
        records.append(QuarterlyCash(
            period=_fmt_period_str(bs.get("date", "")),
            cash=cash,
            short_term_investments=sti,
            total_liquid=cash + sti,
        ))

    return CashResponse(ticker=ticker.upper(), quarterly=records)


async def get_order_backlog(ticker: str) -> OrderBacklogResponse:
    try:
        return await _get_order_backlog_inner(ticker)
    except Exception as exc:
        logger.warning("get_order_backlog failed for %s: %s", ticker, exc)
        return OrderBacklogResponse(ticker=ticker.upper(), annual=[])


async def _get_order_backlog_inner(ticker: str) -> OrderBacklogResponse:
    # FMP returns newest-first; reverse for chronological display
    statements = list(reversed(await fmp_client.get_income_statements_annual(ticker)))

    records: list[AnnualBacklog] = []
    for stmt in statements[-5:]:
        year = int(stmt.get("date", "2000-01-01")[:4])
        rev = float(stmt.get("revenue") or 0.0)
        records.append(AnnualBacklog(year=year, revenue=rev))

    return OrderBacklogResponse(
        ticker=ticker.upper(),
        annual=records,
        note="Order backlog data unavailable via public API; annual revenue shown as proxy.",
    )
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
pytest tests/test_financials.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/financials_service.py backend/tests/test_financials.py
git commit -m "feat: migrate financials_service to FMP"
```

---

## Task 5: ratios_service + test_ratios

**Files:**
- Modify: `backend/app/services/ratios_service.py`
- Modify: `backend/tests/test_ratios.py`

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_ratios.py` entirely:

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.services.ratios_service import get_ratios
from app.models.schemas import RatiosResponse
from app.services import fmp_client

MOCK_KEY_METRICS = {
    "peRatio": 28.5,
    "pbRatio": 45.2,
    "enterpriseValueOverEBITDA": 22.1,
    "pfcfRatio": 27.0,
    "debtToEquity": 1.5,
    "enterpriseValue": 2_735_000_000_000,
    "marketCap": 2_700_000_000_000,
}

MOCK_PROFILE = {"sector": "Technology"}

# FMP returns newest-first
MOCK_CASH_FLOW_A = [
    {"date": "2023-12-31", "freeCashFlow": 9.9e10},
    {"date": "2022-12-31", "freeCashFlow": 9.5e10},
    {"date": "2021-12-31", "freeCashFlow": 9.3e10},
    {"date": "2020-12-31", "freeCashFlow": 8.0e10},
    {"date": "2019-12-31", "freeCashFlow": 7.5e10},
]

MOCK_BALANCE_A = [
    {"date": "2023-12-31", "totalDebt": 1.08e11, "totalStockholdersEquity": 6.2e10},
    {"date": "2022-12-31", "totalDebt": 1.10e11, "totalStockholdersEquity": 5.8e10},
    {"date": "2021-12-31", "totalDebt": 1.22e11, "totalStockholdersEquity": 6.3e10},
    {"date": "2020-12-31", "totalDebt": 1.12e11, "totalStockholdersEquity": 6.5e10},
    {"date": "2019-12-31", "totalDebt": 1.08e11, "totalStockholdersEquity": 9.0e10},
]


def _patch_all():
    return (
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_profile", new=AsyncMock(return_value=MOCK_PROFILE)),
        patch.object(fmp_client, "get_cash_flow_annual", new=AsyncMock(return_value=MOCK_CASH_FLOW_A)),
        patch.object(fmp_client, "get_balance_sheets_annual", new=AsyncMock(return_value=MOCK_BALANCE_A)),
    )


@pytest.mark.anyio
async def test_get_ratios_returns_schema():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    assert isinstance(result, RatiosResponse)
    assert result.ticker == "AAPL"


@pytest.mark.anyio
async def test_get_ratios_has_five_current_ratios():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    names = [r.name for r in result.current]
    assert "P/E" in names
    assert "P/B" in names
    assert "EV/EBITDA" in names
    assert "P/FCF" in names
    assert "D/E" in names


@pytest.mark.anyio
async def test_get_ratios_historical_has_five_years():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    assert len(result.historical) == 5


@pytest.mark.anyio
async def test_get_ratios_sector_benchmark_technology():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    pe_ratio = next(r for r in result.current if r.name == "P/E")
    assert pe_ratio.sector_average == 28.0  # Technology PE benchmark
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
pytest tests/test_ratios.py -v
```

Expected: 4 FAILED

- [ ] **Step 3: Rewrite ratios_service.py**

```python
import asyncio
import logging
from typing import Optional
from app.models.schemas import RatiosResponse, RatioWithBenchmark, HistoricalRatio
from app.services import fmp_client

SECTOR_PE_BENCHMARKS: dict[str, float] = {
    "Technology": 28.0, "Healthcare": 22.0, "Financial Services": 14.0,
    "Consumer Cyclical": 20.0, "Communication Services": 18.0,
    "Industrials": 20.0, "Consumer Defensive": 22.0, "Energy": 12.0,
    "Utilities": 16.0, "Real Estate": 30.0, "Basic Materials": 15.0,
}

SECTOR_PB_BENCHMARKS: dict[str, float] = {
    "Technology": 8.0, "Healthcare": 5.0, "Financial Services": 1.3,
    "Consumer Cyclical": 4.5, "Communication Services": 3.5,
    "Industrials": 3.5, "Consumer Defensive": 5.0, "Energy": 1.8,
    "Utilities": 1.6, "Real Estate": 2.0, "Basic Materials": 2.0,
}

logger = logging.getLogger(__name__)


def _safe_float(val) -> Optional[float]:
    try:
        v = float(val)
        return round(v, 2) if v == v else None
    except (TypeError, ValueError):
        return None


async def get_ratios(ticker: str) -> RatiosResponse:
    try:
        return await _get_ratios_inner(ticker)
    except Exception as exc:
        logger.warning("ratios_service failed for %s: %s", ticker, exc)
        return RatiosResponse(ticker=ticker.upper(), current=[], historical=[])


async def _get_ratios_inner(ticker: str) -> RatiosResponse:
    metrics, profile, cash_flows, balance_sheets = await asyncio.gather(
        fmp_client.get_key_metrics(ticker),
        fmp_client.get_profile(ticker),
        fmp_client.get_cash_flow_annual(ticker),
        fmp_client.get_balance_sheets_annual(ticker),
    )

    sector = profile.get("sector", "Technology")
    market_cap = float(metrics.get("marketCap") or 0.0)

    pe = _safe_float(metrics.get("peRatio"))
    pb = _safe_float(metrics.get("pbRatio"))
    ev_ebitda = _safe_float(metrics.get("enterpriseValueOverEBITDA"))
    p_fcf = _safe_float(metrics.get("pfcfRatio"))
    d_e = _safe_float(metrics.get("debtToEquity"))

    current = [
        RatioWithBenchmark(name="P/E",       value=pe,       sector_average=SECTOR_PE_BENCHMARKS.get(sector)),
        RatioWithBenchmark(name="P/B",       value=pb,       sector_average=SECTOR_PB_BENCHMARKS.get(sector)),
        RatioWithBenchmark(name="EV/EBITDA", value=ev_ebitda, sector_average=15.0),
        RatioWithBenchmark(name="P/FCF",     value=p_fcf,    sector_average=20.0),
        RatioWithBenchmark(name="D/E",       value=d_e,      sector_average=1.5),
    ]

    # Build historical by joining cash-flow and balance-sheet on year
    cf_by_year = {cf["date"][:4]: cf for cf in cash_flows if cf.get("date")}
    bs_by_year = {bs["date"][:4]: bs for bs in balance_sheets if bs.get("date")}
    years = sorted(set(cf_by_year) | set(bs_by_year))[-5:]

    historical: list[HistoricalRatio] = []
    for year in years:
        cf = cf_by_year.get(year, {})
        bs = bs_by_year.get(year, {})

        fcf = _safe_float(cf.get("freeCashFlow"))
        hist_p_fcf = round(market_cap / fcf, 2) if fcf and fcf > 0 else None

        total_debt = _safe_float(bs.get("totalDebt"))
        equity = _safe_float(bs.get("totalStockholdersEquity"))
        hist_de = round(total_debt / equity, 2) if total_debt is not None and equity and equity != 0 else None

        historical.append(HistoricalRatio(year=int(year), p_fcf=hist_p_fcf, d_e=hist_de))

    return RatiosResponse(ticker=ticker.upper(), current=current, historical=historical)
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
pytest tests/test_ratios.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ratios_service.py backend/tests/test_ratios.py
git commit -m "feat: migrate ratios_service to FMP"
```

---

## Task 6: ownership_service + test_ownership

**Files:**
- Modify: `backend/app/services/ownership_service.py`
- Modify: `backend/tests/test_ownership.py`

Note: FMP's free tier does not expose insider ownership percentage as a direct field. `insider_pct` returns `0.0`. The `test_get_ownership_percentages_correct` test is updated to reflect this. Institutional percentage is summed from the holders list (`sharesPercent` × 100).

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_ownership.py` entirely:

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.services.ownership_service import get_ownership, get_dividends
from app.models.schemas import OwnershipResponse, DividendResponse
from app.services import fmp_client

MOCK_HOLDERS = [
    {"holder": "Vanguard Group", "shares": 1_200_000_000, "sharesPercent": 0.079},
    {"holder": "BlackRock",      "shares": 1_000_000_000, "sharesPercent": 0.065},
]

# FMP returns newest-first
MOCK_DIVIDENDS = [
    {"date": "2024-02-09", "dividend": 0.24, "recordDate": "2024-02-12", "declarationDate": "2024-02-01"},
    {"date": "2023-11-10", "dividend": 0.24, "recordDate": "2023-11-13", "declarationDate": "2023-11-02"},
    {"date": "2023-08-11", "dividend": 0.24, "recordDate": "2023-08-14", "declarationDate": "2023-08-03"},
    {"date": "2023-05-12", "dividend": 0.24, "recordDate": "2023-05-15", "declarationDate": "2023-05-04"},
]

MOCK_DIVIDENDS_WITH_OLD = [
    {"date": "2024-02-09", "dividend": 0.24, "recordDate": None, "declarationDate": None},
    {"date": "2023-11-10", "dividend": 0.24, "recordDate": None, "declarationDate": None},
    {"date": "2018-01-01", "dividend": 0.20, "recordDate": None, "declarationDate": None},
]


@pytest.mark.anyio
async def test_get_ownership_returns_schema():
    with patch.object(fmp_client, "get_institutional_holders", new=AsyncMock(return_value=MOCK_HOLDERS)):
        result = await get_ownership("AAPL")
    assert isinstance(result, OwnershipResponse)
    assert result.ticker == "AAPL"
    assert 0 <= result.insider_pct <= 100
    assert 0 <= result.institutional_pct <= 100
    assert len(result.top_holders) == 2


@pytest.mark.anyio
async def test_get_ownership_percentages_correct():
    with patch.object(fmp_client, "get_institutional_holders", new=AsyncMock(return_value=MOCK_HOLDERS)):
        result = await get_ownership("AAPL")
    # insider_pct is 0.0 — not available on FMP free tier
    assert result.insider_pct == 0.0
    # institutional_pct = sum of sharesPercent * 100 = (0.079 + 0.065) * 100 = 14.4
    assert abs(result.institutional_pct - 14.4) < 0.01


@pytest.mark.anyio
async def test_get_dividends_returns_schema():
    with patch.object(fmp_client, "get_dividends", new=AsyncMock(return_value=MOCK_DIVIDENDS)):
        result = await get_dividends("AAPL")
    assert isinstance(result, DividendResponse)
    assert len(result.dividends) == 4
    assert result.dividends[0].amount == 0.24


@pytest.mark.anyio
async def test_get_dividends_filters_to_five_years():
    with patch.object(fmp_client, "get_dividends", new=AsyncMock(return_value=MOCK_DIVIDENDS_WITH_OLD)):
        result = await get_dividends("AAPL")
    # 2018-01-01 is outside the 5-year window from today (2026-04-13)
    assert len(result.dividends) == 2
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
pytest tests/test_ownership.py -v
```

Expected: 4 FAILED

- [ ] **Step 3: Rewrite ownership_service.py**

```python
import logging
from datetime import datetime, timedelta
from app.models.schemas import (
    OwnershipResponse, OwnershipRecord,
    DividendResponse, DividendRecord,
)
from app.services import fmp_client

logger = logging.getLogger(__name__)

_FIVE_YEARS_AGO = lambda: (datetime.now() - timedelta(days=5 * 365)).strftime("%Y-%m-%d")


async def get_ownership(ticker: str) -> OwnershipResponse:
    try:
        return await _get_ownership_inner(ticker)
    except Exception as exc:
        logger.warning("get_ownership failed for %s: %s", ticker, exc)
        return OwnershipResponse(ticker=ticker.upper(), insider_pct=0.0, institutional_pct=0.0, top_holders=[])


async def _get_ownership_inner(ticker: str) -> OwnershipResponse:
    holders = await fmp_client.get_institutional_holders(ticker)

    inst_pct = round(
        sum(float(h.get("sharesPercent") or 0.0) for h in holders[:10]) * 100, 2
    )

    top_holders = [
        OwnershipRecord(
            holder=str(h.get("holder", "")),
            shares=float(h.get("shares") or 0),
            pct_out=round(float(h.get("sharesPercent") or 0.0) * 100, 2),
            holder_type="institutional",
        )
        for h in holders[:10]
    ]

    return OwnershipResponse(
        ticker=ticker.upper(),
        insider_pct=0.0,   # Not available on FMP free tier
        institutional_pct=inst_pct,
        top_holders=top_holders,
    )


async def get_dividends(ticker: str) -> DividendResponse:
    try:
        return await _get_dividends_inner(ticker)
    except Exception as exc:
        logger.warning("get_dividends failed for %s: %s", ticker, exc)
        return DividendResponse(ticker=ticker.upper(), dividends=[])


async def _get_dividends_inner(ticker: str) -> DividendResponse:
    dividends = await fmp_client.get_dividends(ticker)
    cutoff = _FIVE_YEARS_AGO()

    records = [
        DividendRecord(
            date=d.get("date", ""),
            amount=float(d.get("dividend") or 0.0),
            yield_pct=None,
            ex_date=d.get("recordDate") or None,
            declaration_date=d.get("declarationDate") or None,
        )
        for d in dividends
        if d.get("date", "") >= cutoff
    ]

    return DividendResponse(ticker=ticker.upper(), dividends=records)
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
pytest tests/test_ownership.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ownership_service.py backend/tests/test_ownership.py
git commit -m "feat: migrate ownership_service to FMP"
```

---

## Task 7: news_service + test_news

**Files:**
- Modify: `backend/app/services/news_service.py`
- Modify: `backend/tests/test_news.py`

- [ ] **Step 1: Write failing tests**

Replace `backend/tests/test_news.py` entirely:

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.services.news_service import get_news
from app.models.schemas import NewsResponse
from app.services import fmp_client

MOCK_NEWS = [
    {
        "title": "Apple Reports Record Revenue",
        "site": "Reuters",
        "url": "https://reuters.com/article/123",
        "publishedDate": "2024-01-01 00:00:00",
        "text": "Apple Inc reported record revenue for Q4.",
    },
    {
        "title": "Apple Launches New iPhone",
        "site": "Bloomberg",
        "url": "https://bloomberg.com/article/456",
        "publishedDate": "2023-12-31 12:00:00",
        "text": None,
    },
]


@pytest.mark.anyio
async def test_get_news_returns_schema():
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=MOCK_NEWS)):
        result = await get_news("AAPL")
    assert isinstance(result, NewsResponse)
    assert result.ticker == "AAPL"
    assert len(result.items) == 2


@pytest.mark.anyio
async def test_get_news_parses_fields():
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=MOCK_NEWS)):
        result = await get_news("AAPL")
    first = result.items[0]
    assert first.title == "Apple Reports Record Revenue"
    assert first.publisher == "Reuters"
    assert first.link == "https://reuters.com/article/123"
    assert "2024" in first.published_at
    assert first.summary == "Apple Inc reported record revenue for Q4."


@pytest.mark.anyio
async def test_get_news_handles_empty():
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=[])):
        result = await get_news("AAPL")
    assert result.items == []


@pytest.mark.anyio
async def test_get_news_caps_at_30():
    big_feed = [
        {"title": f"Article {i}", "site": "X", "url": "http://x.com",
         "publishedDate": "2024-01-01 00:00:00", "text": None}
        for i in range(50)
    ]
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=big_feed)):
        result = await get_news("AAPL")
    assert len(result.items) <= 30
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
pytest tests/test_news.py -v
```

Expected: 4 FAILED

- [ ] **Step 3: Rewrite news_service.py**

```python
import logging
from app.models.schemas import NewsResponse, NewsItem
from app.services import fmp_client

logger = logging.getLogger(__name__)


async def get_news(ticker: str) -> NewsResponse:
    try:
        return await _get_news_inner(ticker)
    except Exception as exc:
        logger.warning("get_news failed for %s: %s", ticker, exc)
        return NewsResponse(ticker=ticker.upper(), items=[])


async def _get_news_inner(ticker: str) -> NewsResponse:
    articles = await fmp_client.get_news(ticker)

    items = [
        NewsItem(
            title=a.get("title", ""),
            publisher=a.get("site", ""),
            link=a.get("url", ""),
            published_at=a.get("publishedDate", ""),
            summary=a.get("text") or None,
        )
        for a in articles[:30]
    ]

    return NewsResponse(ticker=ticker.upper(), items=items)
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
pytest tests/test_news.py -v
```

Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/news_service.py backend/tests/test_news.py
git commit -m "feat: migrate news_service to FMP"
```

---

## Task 8: Full test suite + cleanup

**Files:**
- Delete: `backend/app/services/ticker_cache.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Run the full test suite — all 40 tests must pass before cleanup**

```bash
cd backend && source .venv/Scripts/activate && pytest --tb=short -q
```

Expected: 40 passed

- [ ] **Step 2: Delete ticker_cache.py**

```bash
rm backend/app/services/ticker_cache.py
```

- [ ] **Step 3: Remove yfinance from requirements.txt**

Edit `backend/requirements.txt` — remove the line `yfinance==0.2.40`.

Final file should be:
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
websockets==12.0
pydantic==2.7.1
pydantic-settings==2.2.1
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
anyio==4.3.0
```

- [ ] **Step 4: Uninstall yfinance from the venv**

```bash
cd backend && source .venv/Scripts/activate && pip uninstall yfinance pandas -y
```

- [ ] **Step 5: Run full test suite again — confirm still clean**

```bash
pytest --tb=short -q
```

Expected: 40 passed

- [ ] **Step 6: Final commit**

```bash
git add backend/requirements.txt
git rm backend/app/services/ticker_cache.py
git commit -m "chore: remove yfinance and ticker_cache — FMP migration complete"
```

---

## Post-Migration: Add your API key

Create `backend/.env`:
```
FINANCIAL_API_KEY=your_fmp_key_here
```

Start the server:
```bash
cd backend && source .venv/Scripts/activate && uvicorn app.main:app --reload --port 8000
```

Test a live endpoint:
```bash
curl "http://localhost:8000/api/market/AAPL" | python -m json.tool
```

Expected: JSON with `price`, `market_cap`, `enterprise_value` populated from FMP.
