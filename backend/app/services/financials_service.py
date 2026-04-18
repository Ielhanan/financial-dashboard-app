import asyncio
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


def _next_quarter(period: str) -> str:
    """'2025-Q4' → '2026-Q1', '2025-Q1' → '2025-Q2'."""
    try:
        year, q = period.split("-Q")
        q = int(q)
        if q == 4:
            return f"{int(year) + 1}-Q1"
        return f"{year}-Q{q + 1}"
    except Exception:
        return period


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
    annual_raw, quarterly_raw, earnings_raw = await asyncio.gather(
        fmp_client.get_income_statements_annual(ticker),
        fmp_client.get_income_statements_quarterly(ticker),
        fmp_client.get_earnings(ticker),
    )

    # FMP returns newest-first; reverse to oldest-first for chronological order
    annual_stmts = list(reversed(annual_raw))
    quarterly_stmts = list(reversed(quarterly_raw))

    # Build a lookup: period label → (eps_estimate, revenue_estimate) from FMP earnings
    earnings_lookup: dict[str, tuple[float | None, float | None]] = {}
    for e in (earnings_raw or []):
        date = e.get("date") or e.get("fiscalDateEnding") or ""
        if not date:
            continue
        period = _fmt_period_str(date[:10])
        eps_est = _safe_float(e.get("epsEstimated"))
        rev_est = _safe_float(e.get("revenueEstimated"))
        earnings_lookup[period] = (eps_est, rev_est)

    eps_records: list[QuarterlyEPS] = []
    rev_records: list[QuarterlyRevenue] = []

    # Annual history — only for fiscal years not already covered by quarterly data
    quarterly_years = {s.get("date", "")[:4] for s in quarterly_stmts}
    for stmt in annual_stmts:
        year = stmt.get("date", "")[:4]
        if year in quarterly_years:
            continue
        eps_records.append(QuarterlyEPS(
            period=f"FY{year}",
            eps_actual=_safe_float(stmt.get("eps")),
            eps_estimate=None,
            eps_yoy_delta_pct=None,
        ))
        rev_records.append(QuarterlyRevenue(
            period=f"FY{year}",
            revenue_actual=_safe_float(stmt.get("revenue")),
            revenue_estimate=None,
            revenue_yoy_delta_pct=None,
        ))

    # Quarterly actuals — merge estimates from FMP earnings endpoint
    for i, stmt in enumerate(quarterly_stmts):
        period = _fmt_period_str(stmt.get("date", ""))
        eps = _safe_float(stmt.get("eps"))
        rev = _safe_float(stmt.get("revenue"))
        prior_eps = _safe_float(quarterly_stmts[i - 4].get("eps")) if i >= 4 else None
        prior_rev = _safe_float(quarterly_stmts[i - 4].get("revenue")) if i >= 4 else None
        est = earnings_lookup.get(period, (None, None))

        eps_records.append(QuarterlyEPS(
            period=period,
            eps_actual=eps,
            eps_estimate=est[0],
            eps_yoy_delta_pct=_yoy_delta(eps, prior_eps),
        ))
        rev_records.append(QuarterlyRevenue(
            period=period,
            revenue_actual=rev,
            revenue_estimate=est[1],
            revenue_yoy_delta_pct=_yoy_delta(rev, prior_rev),
        ))

    # 4 projected future quarters
    _append_projections(quarterly_stmts, eps_records, rev_records)

    return EPSRevenueResponse(
        ticker=ticker.upper(),
        quarterly_eps=eps_records,
        quarterly_revenue=rev_records,
    )


def _append_projections(
    quarterly_stmts: list[dict],
    eps_records: list[QuarterlyEPS],
    rev_records: list[QuarterlyRevenue],
) -> None:
    """Append 4 estimated future quarters using average YoY growth rate."""
    if not quarterly_stmts:
        return

    # Average YoY growth from actual quarterly records (skip FY and None)
    yoy_eps = [r.eps_yoy_delta_pct for r in eps_records
               if not r.period.startswith("FY") and r.eps_yoy_delta_pct is not None]
    yoy_rev = [r.revenue_yoy_delta_pct for r in rev_records
               if not r.period.startswith("FY") and r.revenue_yoy_delta_pct is not None]

    eps_growth = (sum(yoy_eps) / len(yoy_eps) / 100) if yoy_eps else 0.05
    rev_growth = (sum(yoy_rev) / len(yoy_rev) / 100) if yoy_rev else 0.05

    # Base values: the 4 most recent actual quarterly records (same-quarter projection)
    actual_eps = [r for r in eps_records if not r.period.startswith("FY") and r.eps_actual is not None]
    actual_rev = [r for r in rev_records if not r.period.startswith("FY") and r.revenue_actual is not None]

    # The last actual period
    last_period = actual_eps[-1].period if actual_eps else "2025-Q4"

    for i in range(4):
        next_period = _next_quarter(last_period)
        last_period = next_period

        # Base: same quarter from prior year (4 back)
        base_eps_idx = len(actual_eps) - 4 + i
        base_rev_idx = len(actual_rev) - 4 + i

        base_eps = actual_eps[base_eps_idx].eps_actual if 0 <= base_eps_idx < len(actual_eps) else (actual_eps[-1].eps_actual if actual_eps else None)
        base_rev = actual_rev[base_rev_idx].revenue_actual if 0 <= base_rev_idx < len(actual_rev) else (actual_rev[-1].revenue_actual if actual_rev else None)

        proj_eps = round(base_eps * (1 + eps_growth), 2) if base_eps is not None else None
        proj_rev = round(base_rev * (1 + rev_growth)) if base_rev is not None else None

        eps_records.append(QuarterlyEPS(
            period=next_period,
            eps_actual=None,
            eps_estimate=proj_eps,
            eps_yoy_delta_pct=round(eps_growth * 100, 1),
        ))
        rev_records.append(QuarterlyRevenue(
            period=next_period,
            revenue_actual=None,
            revenue_estimate=proj_rev,
            revenue_yoy_delta_pct=round(rev_growth * 100, 1),
        ))


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
