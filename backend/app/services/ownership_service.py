import asyncio
import pandas as pd
import yfinance as yf
from app.models.schemas import (
    OwnershipResponse, OwnershipRecord,
    DividendResponse, DividendRecord,
)


async def get_ownership(ticker: str) -> OwnershipResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    info = t.info
    insider_pct = float(info.get("heldPercentInsiders") or 0.0) * 100
    inst_pct = float(info.get("heldPercentInstitutions") or 0.0) * 100

    holders: list[OwnershipRecord] = []
    ih = t.institutional_holders
    if ih is not None and not ih.empty:
        for _, row in ih.head(10).iterrows():
            holders.append(OwnershipRecord(
                holder=str(row.get("Holder", "")),
                shares=float(row.get("Shares", 0)),
                pct_out=float(row.get("% Out", 0)) * 100,
                holder_type="institutional",
            ))

    return OwnershipResponse(
        ticker=ticker.upper(),
        insider_pct=round(insider_pct, 2),
        institutional_pct=round(inst_pct, 2),
        top_holders=holders,
    )


async def get_dividends(ticker: str) -> DividendResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    divs = t.dividends
    yield_pct = float(t.info.get("trailingAnnualDividendYield") or 0.0) * 100

    records: list[DividendRecord] = []
    if divs is not None and not divs.empty:
        cutoff = divs.index.max() - pd.DateOffset(years=5)
        recent = divs[divs.index >= cutoff]

        for date, amount in recent.items():
            records.append(DividendRecord(
                date=date.date().isoformat(),
                amount=float(amount),
                yield_pct=round(yield_pct, 2),
                ex_date=None,
                declaration_date=None,
            ))

    return DividendResponse(ticker=ticker.upper(), dividends=records)
