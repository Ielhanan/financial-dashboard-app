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
