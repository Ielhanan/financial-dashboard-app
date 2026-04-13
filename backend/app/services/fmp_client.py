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
