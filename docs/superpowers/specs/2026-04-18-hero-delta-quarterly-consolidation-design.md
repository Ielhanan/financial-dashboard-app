# Design: Hero Delta Indicators & Quarterly Table Consolidation

**Date:** 2026-04-18  
**Status:** Approved

---

## Overview

Two UI improvements to the financial dashboard:

1. Add real daily price change and YoY trend indicators to the `MarketPerformanceCard` hero section
2. Consolidate the "EPS & Revenue — Quarterly Detail" table from 8 columns down to 5 by stacking actual/estimate values in a single cell

All data is sourced from endpoints already fetched on each snapshot tick — no new HTTP calls are introduced.

---

## Section 1: Backend — Extend `MarketSnapshot`

### Schema (`backend/app/models/schemas.py`)

Add four new fields to `MarketSnapshot`:

```python
class MarketSnapshot(BaseModel):
    ticker: str
    price: float
    market_cap: float
    enterprise_value: float
    shares_outstanding: float
    total_debt: float
    cash: float
    # New fields
    change: float            # daily $ change (from FMP quote)
    change_pct: float        # daily % change (from FMP quote)
    market_cap_yoy: float | None   # % YoY vs prior annual key metrics entry
    total_debt_yoy: float | None   # % YoY vs same quarter 1 year ago
```

### Service (`backend/app/services/market_service.py`)

All data is already fetched in the existing `asyncio.gather` call:

| Field | Source | Logic |
|---|---|---|
| `change` | `quote["change"]` | Direct passthrough |
| `change_pct` | `quote["changesPercentage"]` | Direct passthrough |
| `market_cap_yoy` | `get_key_metrics()` annual array | `(metrics[0]["marketCap"] / metrics[1]["marketCap"] - 1) * 100`; `None` if fewer than 2 entries |
| `total_debt_yoy` | `get_balance_sheets_quarterly()` | `(sheets[0]["totalDebt"] / sheets[4]["totalDebt"] - 1) * 100`; `None` if fewer than 5 entries |

Guard all divisions against zero/null.

---

## Section 2: Frontend — `MarketPerformanceCard` Hero Updates

### Type (`frontend/src/types/financial.ts`)

Add to `MarketSnapshot` interface:
```ts
change: number
change_pct: number
market_cap_yoy: number | null
total_debt_yoy: number | null
```

### UI (`frontend/src/components/market/MarketPerformanceCard.tsx`)

**Price row** — append a colored delta badge inline with the price:
```tsx
<span className={snapshot.change >= 0 ? "text-green-500" : "text-red-500"}>
  {snapshot.change >= 0 ? "+" : ""}
  {snapshot.change.toFixed(2)} ({snapshot.change_pct.toFixed(2)}%)
</span>
```

**Metric cards** — Market Cap and Total Debt cards get a muted YoY sub-line when the field is non-null. The grid map is refactored to carry an optional `yoy` value per card:

```tsx
{ label: "Market Cap",   value: fmt(snapshot.market_cap),   yoy: snapshot.market_cap_yoy },
{ label: "Total Debt",   value: fmt(snapshot.total_debt),    yoy: snapshot.total_debt_yoy },
{ label: "Enterprise Value", value: fmt(snapshot.enterprise_value), yoy: null },
{ label: "Cash & Equivalents", value: fmt(snapshot.cash),   yoy: null },
```

Each card renders:
```tsx
{yoy != null && (
  <p className={`text-xs mt-0.5 ${yoy >= 0 ? "text-green-500/70" : "text-red-500/70"}`}>
    {yoy >= 0 ? "↑" : "↓"} {Math.abs(yoy).toFixed(1)}% YoY
  </p>
)}
```

---

## Section 3: DataTable Extension + Quarterly Table Consolidation

### DataTable (`frontend/src/components/shared/DataTable.tsx`)

Add optional `render` to `Column<T>`:
```ts
interface Column<T> {
  key: keyof T;
  label: string;
  format?: (val: T[keyof T]) => string;
  render?: (val: T[keyof T], row: T) => React.ReactNode;   // new
}
```

In the `<td>` render, check `render` before `format`:
```tsx
{col.render
  ? col.render(row[col.key], row)
  : col.format
    ? col.format(row[col.key])
    : String(row[col.key] ?? "—")}
```

### Quarterly Table (`frontend/src/components/financials/EPSRevenueChart.tsx`)

**Columns removed:** `Rev Actual`, `Rev Estimate`, `EPS Actual`, `EPS Est.`, `Type`

**Columns added:** `Revenue`, `EPS` (using `render`)

**Final column order:** `Period · Revenue · Rev YoY · EPS · EPS YoY`

Beat/miss coloring logic per cell:
- `actual != null && estimate != null && actual > estimate` → actual text `text-green-400`
- `actual != null && estimate != null && actual < estimate` → actual text `text-red-400`
- estimate-only rows (future quarters) → neutral, only estimate line shown

Cell structure for Revenue:
```tsx
render: (_, row) => (
  <div>
    <span className={beatMissClass(row.revenue_actual, row.revenue_estimate)}>
      {fmtRev(row.revenue_actual)}
    </span>
    {row.revenue_estimate != null && (
      <div className="text-xs text-slate-500">Est: {fmtRev(row.revenue_estimate)}</div>
    )}
  </div>
)
```

Same pattern for EPS using `fmtEPS`.

---

## Files Changed

| File | Change |
|---|---|
| `backend/app/models/schemas.py` | Add 4 fields to `MarketSnapshot` |
| `backend/app/services/market_service.py` | Extract and compute new fields |
| `frontend/src/types/financial.ts` | Add 4 fields to `MarketSnapshot` interface |
| `frontend/src/components/market/MarketPerformanceCard.tsx` | Price delta badge + YoY card sub-lines |
| `frontend/src/components/shared/DataTable.tsx` | Add `render` to `Column` interface |
| `frontend/src/components/financials/EPSRevenueChart.tsx` | Consolidate quarterly table columns |
