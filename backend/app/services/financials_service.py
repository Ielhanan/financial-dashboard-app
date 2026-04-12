import asyncio
import logging
from typing import Optional
import yfinance as yf
import pandas as pd
from app.models.schemas import (
    EPSRevenueResponse, QuarterlyEPS, QuarterlyRevenue,
    CashResponse, QuarterlyCash,
    OrderBacklogResponse, AnnualBacklog,
)

logger = logging.getLogger(__name__)


def _fmt_period(ts) -> str:
    """Convert a pandas Timestamp to '2024-Q1' format."""
    q = (ts.month - 1) // 3 + 1
    return f"{ts.year}-Q{q}"


def _yoy_delta(current: Optional[float], prior: Optional[float]) -> Optional[float]:
    if current is None or prior is None or prior == 0:
        return None
    return round((current - prior) / abs(prior) * 100, 2)


async def get_eps_revenue(ticker: str) -> EPSRevenueResponse:
    try:
        return await _get_eps_revenue_inner(ticker)
    except Exception as exc:
        logger.warning("get_eps_revenue failed for %s: %s", ticker, exc)
        return EPSRevenueResponse(ticker=ticker.upper(), quarterly_eps=[], quarterly_revenue=[])


async def _get_eps_revenue_inner(ticker: str) -> EPSRevenueResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    qe = t.quarterly_earnings  # index: date, cols: Earnings, Revenue

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
                eps_estimate=None,
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
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    bs = t.quarterly_balance_sheet

    records: list[QuarterlyCash] = []
    if bs is not None and not bs.empty:
        for col in sorted(bs.columns)[-20:]:
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
    try:
        return await _get_order_backlog_inner(ticker)
    except Exception as exc:
        logger.warning("get_order_backlog failed for %s: %s", ticker, exc)
        return OrderBacklogResponse(ticker=ticker.upper(), annual=[])


async def _get_order_backlog_inner(ticker: str) -> OrderBacklogResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    fin = t.financials
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
