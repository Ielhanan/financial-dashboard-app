import asyncio
import logging
from typing import Optional
import yfinance as yf
from app.models.schemas import RatiosResponse, RatioWithBenchmark, HistoricalRatio

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


def _safe_float(val) -> Optional[float]:
    try:
        v = float(val)
        return round(v, 2) if v == v else None   # NaN check
    except (TypeError, ValueError):
        return None


logger = logging.getLogger(__name__)


async def get_ratios(ticker: str) -> RatiosResponse:
    try:
        return await _get_ratios_inner(ticker)
    except Exception as exc:
        logger.warning("ratios_service failed for %s: %s", ticker, exc)
        return RatiosResponse(ticker=ticker.upper(), current=[], historical=[])


async def _get_ratios_inner(ticker: str) -> RatiosResponse:
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
