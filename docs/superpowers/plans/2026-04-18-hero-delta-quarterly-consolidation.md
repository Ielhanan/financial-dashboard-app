# Hero Delta Indicators & Quarterly Table Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real daily price change + YoY trend indicators to the MarketPerformanceCard hero, and consolidate the Quarterly Detail table from 8 columns to 5 by stacking actual/estimate in single cells.

**Architecture:** Backend extends `MarketSnapshot` with four new fields (`change`, `change_pct`, `market_cap_yoy`, `total_debt_yoy`) sourced from data already fetched on each snapshot tick. Frontend consumes these fields in `MarketPerformanceCard`. A new `render` prop on `DataTable`'s `Column` interface unlocks JSX cells without duplicating the table component.

**Tech Stack:** Python/FastAPI (backend), Next.js/React/TypeScript (frontend), Zustand, Tailwind CSS, pytest/anyio

---

## File Map

| File | Change |
|---|---|
| `backend/app/services/fmp_client.py` | Add `get_key_metrics_annual()` (limit=2, returns list) |
| `backend/app/models/schemas.py` | Add 4 fields to `MarketSnapshot` |
| `backend/app/services/market_service.py` | Use `get_key_metrics_annual`; compute new fields |
| `backend/tests/test_market.py` | Update mocks; add assertions for new fields |
| `frontend/src/types/financial.ts` | Add 4 fields to `MarketSnapshot` interface |
| `frontend/src/components/market/MarketPerformanceCard.tsx` | Price delta badge + YoY sub-lines on cards |
| `frontend/src/components/shared/DataTable.tsx` | Add `render` to `Column` interface |
| `frontend/src/components/financials/EPSRevenueChart.tsx` | Consolidate quarterly table to 5 columns |

---

## Task 1: Add `get_key_metrics_annual` to fmp_client

**Files:**
- Modify: `backend/app/services/fmp_client.py`

- [ ] **Step 1: Add the new function after the existing `get_key_metrics`**

Open `backend/app/services/fmp_client.py`. Find the `get_key_metrics` function (currently around line 155). Add this new function directly after it:

```python
async def get_key_metrics_annual(ticker: str) -> list[dict]:
    """GET /key-metrics?symbol={ticker}&period=annual&limit=2 — returns up to 2 annual entries for YoY comparison."""
    data = await _cached(
        ticker, "key_metrics_annual", "/key-metrics", _TTL_RATIOS,
        {"symbol": ticker, "period": "annual", "limit": 2},
    )
    return data if isinstance(data, list) else []
```

- [ ] **Step 2: Verify the existing tests still pass (no regressions)**

```bash
cd backend
source .venv/Scripts/activate
pytest tests/test_market.py tests/test_ratios.py -v
```

Expected: all existing tests PASS (we added a function, changed nothing).

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/fmp_client.py
git commit -m "feat: add get_key_metrics_annual to fmp_client (limit=2 for YoY)"
```

---

## Task 2: Extend `MarketSnapshot` schema

**Files:**
- Modify: `backend/app/models/schemas.py`

- [ ] **Step 1: Add four new fields to `MarketSnapshot`**

Open `backend/app/models/schemas.py`. Replace the `MarketSnapshot` class with:

```python
class MarketSnapshot(BaseModel):
    ticker: str
    price: float
    market_cap: float          # USD
    enterprise_value: float    # USD
    shares_outstanding: float
    total_debt: float
    cash: float
    change: float              # daily $ change
    change_pct: float          # daily % change
    market_cap_yoy: Optional[float]   # % YoY vs prior annual entry; None if unavailable
    total_debt_yoy: Optional[float]   # % YoY vs same quarter 1 year ago; None if unavailable
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "feat: extend MarketSnapshot schema with change, change_pct, market_cap_yoy, total_debt_yoy"
```

---

## Task 3: Update `market_service` to compute new fields + fix tests

**Files:**
- Modify: `backend/app/services/market_service.py`
- Modify: `backend/tests/test_market.py`

- [ ] **Step 1: Write the failing tests first**

Open `backend/tests/test_market.py`. Replace the entire file with:

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
    "change": 3.45,
    "changesPercentage": 2.01,
}
MOCK_KEY_METRICS_LIST = [
    {"enterpriseValue": 2_735_000_000_000, "marketCap": 2_700_000_000_000},
    {"enterpriseValue": 2_500_000_000_000, "marketCap": 2_500_000_000_000},
]
MOCK_BALANCE_SHEETS_Q = [
    {"date": "2024-03-30", "cashAndCashEquivalents": 73_000_000_000, "totalDebt": 108_000_000_000},
    {"date": "2023-12-30", "cashAndCashEquivalents": 70_000_000_000, "totalDebt": 110_000_000_000},
    {"date": "2023-09-30", "cashAndCashEquivalents": 68_000_000_000, "totalDebt": 112_000_000_000},
    {"date": "2023-06-30", "cashAndCashEquivalents": 65_000_000_000, "totalDebt": 115_000_000_000},
    {"date": "2023-03-30", "cashAndCashEquivalents": 63_000_000_000, "totalDebt": 120_000_000_000},
]


def _patch_all(quote=MOCK_QUOTE, metrics=MOCK_KEY_METRICS_LIST, sheets=MOCK_BALANCE_SHEETS_Q):
    return (
        patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=quote)),
        patch.object(fmp_client, "get_key_metrics_annual", new=AsyncMock(return_value=metrics)),
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=sheets)),
    )


@pytest.mark.anyio
async def test_get_market_snapshot_returns_schema():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    assert isinstance(result, MarketSnapshot)
    assert result.ticker == "AAPL"
    assert result.price == 175.50
    assert result.market_cap == 2_700_000_000_000


@pytest.mark.anyio
async def test_get_market_snapshot_uses_ev_from_key_metrics():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    assert result.enterprise_value == 2_735_000_000_000


@pytest.mark.anyio
async def test_get_market_snapshot_daily_change():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    assert result.change == 3.45
    assert result.change_pct == 2.01


@pytest.mark.anyio
async def test_get_market_snapshot_market_cap_yoy():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    # (2_700B / 2_500B - 1) * 100 = 8.0%
    assert result.market_cap_yoy == pytest.approx(8.0, rel=0.01)


@pytest.mark.anyio
async def test_get_market_snapshot_market_cap_yoy_none_when_single_entry():
    with _patch_all(metrics=[MOCK_KEY_METRICS_LIST[0]]):
        result = await get_market_snapshot("AAPL")

    assert result.market_cap_yoy is None


@pytest.mark.anyio
async def test_get_market_snapshot_total_debt_yoy():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    # (108B / 120B - 1) * 100 = -10.0%
    assert result.total_debt_yoy == pytest.approx(-10.0, rel=0.01)


@pytest.mark.anyio
async def test_get_market_snapshot_total_debt_yoy_none_when_fewer_than_5_sheets():
    with _patch_all(sheets=MOCK_BALANCE_SHEETS_Q[:3]):
        result = await get_market_snapshot("AAPL")

    assert result.total_debt_yoy is None


@pytest.mark.anyio
async def test_market_rest_endpoint(client):
    with _patch_all():
        response = await client.get("/api/market/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["price"] == 175.50
    assert "enterprise_value" in data
    assert "change" in data
    assert "market_cap_yoy" in data
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pytest tests/test_market.py -v
```

Expected: most tests FAIL because `market_service` still uses the old `get_key_metrics` and doesn't compute the new fields.

- [ ] **Step 3: Rewrite `market_service.py`**

Replace the entire contents of `backend/app/services/market_service.py` with:

```python
import asyncio
import logging
from app.models.schemas import MarketSnapshot
from app.services import fmp_client

logger = logging.getLogger(__name__)


async def get_market_snapshot(ticker: str) -> MarketSnapshot:
    try:
        quote, key_metrics_list, balance_sheets = await asyncio.gather(
            fmp_client.get_quote(ticker),
            fmp_client.get_key_metrics_annual(ticker),
            fmp_client.get_balance_sheets_quarterly(ticker),
        )

        price = float(quote.get("price") or 0.0)
        market_cap = float(quote.get("marketCap") or 0.0)
        shares = round(market_cap / price, 0) if price > 0 else 0.0

        latest_metrics = key_metrics_list[0] if key_metrics_list else {}
        ev = float(latest_metrics.get("enterpriseValue") or market_cap)

        latest_sheet = balance_sheets[0] if balance_sheets else {}
        total_debt = float(latest_sheet.get("totalDebt") or 0.0)
        cash = float(latest_sheet.get("cashAndCashEquivalents") or 0.0)

        change = float(quote.get("change") or 0.0)
        change_pct = float(quote.get("changesPercentage") or 0.0)

        market_cap_yoy = None
        if len(key_metrics_list) >= 2:
            prior_mc = float(key_metrics_list[1].get("marketCap") or 0.0)
            if prior_mc > 0:
                market_cap_yoy = round((market_cap / prior_mc - 1) * 100, 1)

        total_debt_yoy = None
        if len(balance_sheets) >= 5:
            prior_debt = float(balance_sheets[4].get("totalDebt") or 0.0)
            if prior_debt > 0:
                total_debt_yoy = round((total_debt / prior_debt - 1) * 100, 1)

        return MarketSnapshot(
            ticker=ticker.upper(),
            price=price,
            market_cap=market_cap,
            enterprise_value=ev,
            shares_outstanding=shares,
            total_debt=total_debt,
            cash=cash,
            change=change,
            change_pct=change_pct,
            market_cap_yoy=market_cap_yoy,
            total_debt_yoy=total_debt_yoy,
        )
    except Exception as exc:
        logger.warning("market_service failed for %s: %s", ticker, exc)
        return MarketSnapshot(
            ticker=ticker.upper(),
            price=0.0, market_cap=0.0, enterprise_value=0.0,
            shares_outstanding=0.0, total_debt=0.0, cash=0.0,
            change=0.0, change_pct=0.0,
            market_cap_yoy=None, total_debt_yoy=None,
        )
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pytest tests/test_market.py -v
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
pytest -v
```

Expected: all tests PASS. (The ratios service still calls `get_key_metrics` which is unchanged.)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/market_service.py backend/tests/test_market.py
git commit -m "feat: compute change, change_pct, market_cap_yoy, total_debt_yoy in market_service"
```

---

## Task 4: Update frontend `MarketSnapshot` type + `MarketPerformanceCard`

**Files:**
- Modify: `frontend/src/types/financial.ts`
- Modify: `frontend/src/components/market/MarketPerformanceCard.tsx`

- [ ] **Step 1: Add four new fields to `MarketSnapshot` in `financial.ts`**

Open `frontend/src/types/financial.ts`. Replace the `MarketSnapshot` interface with:

```ts
export interface MarketSnapshot {
  ticker: string;
  price: number;
  market_cap: number;
  enterprise_value: number;
  shares_outstanding: number;
  total_debt: number;
  cash: number;
  change: number;
  change_pct: number;
  market_cap_yoy: number | null;
  total_debt_yoy: number | null;
}
```

- [ ] **Step 2: Rewrite `MarketPerformanceCard.tsx`**

Replace the entire contents of `frontend/src/components/market/MarketPerformanceCard.tsx` with:

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
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{ticker}</span>
          {snapshot && (
            <>
              <span className="text-xl text-blue-600 dark:text-blue-300 font-mono font-medium">
                ${snapshot.price.toFixed(2)}
              </span>
              <span className={`text-sm font-mono ${snapshot.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                {snapshot.change >= 0 ? "+" : ""}
                {snapshot.change.toFixed(2)} ({snapshot.change_pct.toFixed(2)}%)
              </span>
            </>
          )}
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-semibold tracking-wide ${
            connected
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
          }`}
        >
          {connected ? "LIVE" : "Connecting…"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Market Cap",        value: fmt(snapshot?.market_cap),        yoy: snapshot?.market_cap_yoy ?? null },
          { label: "Enterprise Value",  value: fmt(snapshot?.enterprise_value),  yoy: null },
          { label: "Total Debt",        value: fmt(snapshot?.total_debt),        yoy: snapshot?.total_debt_yoy ?? null },
          { label: "Cash & Equivalents",value: fmt(snapshot?.cash),              yoy: null },
        ].map(({ label, value, yoy }) => (
          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-700/30">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{value}</p>
            {yoy != null && (
              <p className={`text-xs mt-0.5 ${yoy >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
                {yoy >= 0 ? "↑" : "↓"} {Math.abs(yoy).toFixed(1)}% YoY
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors related to `MarketSnapshot`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/financial.ts frontend/src/components/market/MarketPerformanceCard.tsx
git commit -m "feat: add daily change badge and YoY indicators to MarketPerformanceCard"
```

---

## Task 5: Extend `DataTable` with `render` prop

**Files:**
- Modify: `frontend/src/components/shared/DataTable.tsx`

- [ ] **Step 1: Add `render` to the `Column` interface**

Open `frontend/src/components/shared/DataTable.tsx`. Replace the `Column` interface (lines 8–12) with:

```ts
interface Column<T> {
  key: keyof T;
  label: string;
  format?: (val: T[keyof T]) => string;
  render?: (val: T[keyof T], row: T) => React.ReactNode;
}
```

- [ ] **Step 2: Update the `<td>` cell render to use `render` when present**

Find this block in the `<tbody>` (currently around line 116–119):

```tsx
{col.format
  ? col.format(row[col.key])
  : String(row[col.key] ?? "—")}
```

Replace it with:

```tsx
{col.render
  ? col.render(row[col.key], row)
  : col.format
    ? col.format(row[col.key])
    : String(row[col.key] ?? "—")}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/DataTable.tsx
git commit -m "feat: add render prop to DataTable Column for JSX cell content"
```

---

## Task 6: Consolidate quarterly table in `EPSRevenueChart`

**Files:**
- Modify: `frontend/src/components/financials/EPSRevenueChart.tsx`

- [ ] **Step 1: Add the beat/miss helper and update the quarterly DataTable columns**

Open `frontend/src/components/financials/EPSRevenueChart.tsx`. 

Add this helper function directly above the `EPSRevenueChart` component declaration (after the `fmtDelta` function):

```tsx
function beatMissClass(actual: number | null, estimate: number | null): string {
  if (actual == null || estimate == null) return "";
  if (actual > estimate) return "text-green-400";
  if (actual < estimate) return "text-red-400";
  return "";
}
```

Then find the `<DataTable>` for the quarterly table (the one with `title="EPS & Revenue — Quarterly Detail"`). Replace its `columns` prop entirely:

```tsx
columns={[
  { key: "period", label: "Period" },
  {
    key: "revenue_actual",
    label: "Revenue",
    render: (_val, row) => (
      <div>
        <span className={beatMissClass(row.revenue_actual as number | null, row.revenue_estimate as number | null)}>
          {fmtRev(row.revenue_actual as number | null)}
        </span>
        {row.revenue_estimate != null && (
          <div className="text-xs text-slate-500">
            Est: {fmtRev(row.revenue_estimate as number | null)}
          </div>
        )}
      </div>
    ),
  },
  { key: "revenue_yoy", label: "Rev YoY", format: (v) => fmtDelta(v as number | null | undefined) },
  {
    key: "eps_actual",
    label: "EPS",
    render: (_val, row) => (
      <div>
        <span className={beatMissClass(row.eps_actual as number | null, row.eps_estimate as number | null)}>
          {fmtEPS(row.eps_actual as number | null)}
        </span>
        {row.eps_estimate != null && (
          <div className="text-xs text-slate-500">
            Est: {fmtEPS(row.eps_estimate as number | null)}
          </div>
        )}
      </div>
    ),
  },
  { key: "eps_yoy", label: "EPS YoY", format: (v) => fmtDelta(v as number | null | undefined) },
]}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/financials/EPSRevenueChart.tsx
git commit -m "feat: consolidate quarterly table — stack actual/estimate in Revenue and EPS columns"
```

---

## Final Verification

- [ ] **Run full backend test suite**

```bash
cd backend
pytest -v
```

Expected: all tests PASS.

- [ ] **Run frontend build**

```bash
cd frontend
npm run build
```

Expected: build succeeds with no errors.
