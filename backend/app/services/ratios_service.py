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
    metrics, ratios, profile, cash_flows, balance_sheets = await asyncio.gather(
        fmp_client.get_key_metrics(ticker),
        fmp_client.get_ratios(ticker),
        fmp_client.get_profile(ticker),
        fmp_client.get_cash_flow_annual(ticker),
        fmp_client.get_balance_sheets_annual(ticker),
    )

    sector = profile.get("sector", "Technology")
    market_cap = float(metrics.get("marketCap") or 0.0)

    pe = _safe_float(ratios.get("priceToEarningsRatio"))
    pb = _safe_float(ratios.get("priceToBookRatio"))
    ev_ebitda = _safe_float(metrics.get("evToEBITDA"))
    p_fcf = _safe_float(ratios.get("priceToFreeCashFlowRatio"))
    d_e = _safe_float(ratios.get("debtToEquityRatio"))

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
