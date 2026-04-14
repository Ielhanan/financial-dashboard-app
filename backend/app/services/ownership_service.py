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
