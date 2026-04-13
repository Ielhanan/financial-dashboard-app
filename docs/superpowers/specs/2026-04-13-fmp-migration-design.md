# Design: Replace yfinance with Financial Modeling Prep (FMP)

**Date:** 2026-04-13
**Status:** Approved

## Problem

`yfinance` scrapes undocumented Yahoo Finance endpoints. Persistent 429 rate-limit
errors and invalid-crumb failures make it unreliable for a production dashboard.

## Decision

Replace all yfinance data fetching with the official Financial Modeling Prep (FMP)
REST API. API key is supplied via the `FINANCIAL_API_KEY` environment variable.

## Architecture

No structural changes to routers, schemas, or the frontend. The diff is confined to:

- `backend/app/services/ticker_cache.py` — **deleted**
- `backend/app/services/fmp_client.py` — **new**: all FMP HTTP calls + in-process cache
- `backend/app/config.py` — add `financial_api_key: str` field
- Five service files — imports updated, yfinance attribute access replaced with fmp_client calls
- `backend/requirements.txt` — remove `yfinance`; `httpx` (already present) is the only HTTP dep

## FMP Endpoints

| Data domain | Endpoint | Cache TTL |
|---|---|---|
| Quote (price, market cap, EV, shares, debt, cash) | `GET /quote/{ticker}` | 5 min |
| Quarterly income statement (EPS, revenue) | `GET /income-statement/{ticker}?period=quarter&limit=20` | 24 hr |
| Annual income statement (revenue proxy) | `GET /income-statement/{ticker}?period=annual&limit=5` | 24 hr |
| Quarterly balance sheet (cash, STI, debt, equity) | `GET /balance-sheet-statement/{ticker}?period=quarter&limit=20` | 24 hr |
| Annual balance sheet (historical D/E) | `GET /balance-sheet-statement/{ticker}?period=annual&limit=5` | 24 hr |
| Annual cash flow (operating CF, capex for FCF) | `GET /cash-flow-statement/{ticker}?period=annual&limit=5` | 24 hr |
| Key metrics / ratios (P/E, P/B, EV/EBITDA, D/E) | `GET /key-metrics/{ticker}?period=annual&limit=1` | 1 hr |
| Institutional holders | `GET /institutional-holder/{ticker}` | 1 hr |
| Historical dividends | `GET /historical-price-full/stock_dividend/{ticker}` | 24 hr |
| Company news | `GET /stock_news?tickers={ticker}&limit=30` | 30 min |

## `fmp_client.py` Design

- Module-level `httpx.AsyncClient` with `base_url` and `params={"apikey": ...}` applied to every request.
- Per-endpoint in-process cache: `dict[str, tuple[Any, float]]` mapping `ticker` → `(data, fetched_at)`.
- Per-ticker `asyncio.Lock` (same pattern as `ticker_cache.py`) ensures no duplicate concurrent fetches for the same ticker + endpoint.
- Every public function returns a typed default (empty list `[]`, empty dict `{}`) on any HTTP error, timeout, or missing data — never raises to the service layer.
- 429 responses log a warning and return the stale cached value if one exists; otherwise return the default.

## Service Layer Changes

All business logic (YoY delta math, ratio benchmark tables, period label formatting,
holder record construction) is unchanged. Only the data-access lines change.

| Service | yfinance property | FMP client function |
|---|---|---|
| `market_service` | `t.info` | `get_quote(ticker)` |
| `financials_service` | `t.quarterly_income_stmt` | `get_income_statements_quarterly(ticker)` |
| `financials_service` | `t.quarterly_balance_sheet` | `get_balance_sheets_quarterly(ticker)` |
| `financials_service` | `t.financials` | `get_income_statements_annual(ticker)` |
| `ratios_service` | `t.info` (PE, PB, etc.) | `get_key_metrics(ticker)` |
| `ratios_service` | `t.cashflow` | `get_cash_flow_annual(ticker)` |
| `ratios_service` | `t.balance_sheet` | `get_balance_sheets_annual(ticker)` |
| `ownership_service` | `t.info` (pct fields) | `get_quote(ticker)` |
| `ownership_service` | `t.institutional_holders` | `get_institutional_holders(ticker)` |
| `ownership_service` | `t.dividends` | `get_dividends(ticker)` |
| `news_service` | `t.news` | `get_news(ticker)` |

## Field Mapping: FMP → Existing Schemas

### Quote → MarketSnapshot
| Schema field | FMP field |
|---|---|
| `price` | `price` |
| `market_cap` | `marketCap` |
| `enterprise_value` | `enterpriseValue` |
| `shares_outstanding` | `sharesOutstanding` |
| `total_debt` | `totalDebt` |
| `cash` | `cashAndCashEquivalentsAndShortTermInvestments` |

### Income Statement → QuarterlyEPS / QuarterlyRevenue
| Schema field | FMP field |
|---|---|
| `eps_actual` | `eps` |
| `revenue_actual` | `revenue` |
| `period` (formatted) | `date` → `"YYYY-QN"` |

### Balance Sheet → QuarterlyCash
| Schema field | FMP field |
|---|---|
| `cash` | `cashAndCashEquivalents` |
| `short_term_investments` | `shortTermInvestments` |

### Key Metrics → RatioWithBenchmark
| Schema field | FMP field |
|---|---|
| P/E | `peRatio` |
| P/B | `pbRatio` |
| EV/EBITDA | `evToEbitda` (or `enterpriseValueOverEBITDA`) |
| D/E | `debtToEquity` |
| P/FCF | computed: `marketCap / freeCashFlow` from cash flow statement |

### Institutional Holder → OwnershipRecord
| Schema field | FMP field |
|---|---|
| `holder` | `holder` |
| `shares` | `shares` |
| `pct_out` | `sharesPercent` × 100 |

### News → NewsItem
| Schema field | FMP field |
|---|---|
| `title` | `title` |
| `publisher` | `site` |
| `link` | `url` |
| `published_at` | `publishedDate` |
| `summary` | `text` |

## Error Handling

- Free-tier 403 on institutional holders: return empty `top_holders` list, log info.
- Any non-200 response: log warning with status code and endpoint, return typed default.
- Network timeout (10 s): log warning, return typed default.
- Missing/null FMP fields: `None` for optional schema fields, `0.0` for required numeric fields.

## Tests

Existing tests mock at the service boundary (`get_ticker_info`, `get_ticker`). After
migration they mock the corresponding `fmp_client` functions. The 40 existing test
cases map 1-to-1; no new test logic is needed, only the patched symbol paths change.

## Out of Scope

- Frontend changes (none required — schemas unchanged)
- Router changes (none required)
- Schema changes (none required)
- WebSocket changes (market_service is called the same way; caching handles rate limits)
