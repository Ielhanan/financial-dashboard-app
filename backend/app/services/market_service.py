import asyncio
import yfinance as yf
from app.models.schemas import MarketSnapshot

async def get_market_snapshot(ticker: str) -> MarketSnapshot:
    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(None, lambda: yf.Ticker(ticker).info)

    price = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0
    market_cap = info.get("marketCap") or 0.0
    total_debt = info.get("totalDebt") or 0.0
    cash = info.get("totalCash") or 0.0
    shares = info.get("sharesOutstanding") or 0.0

    ev = info.get("enterpriseValue")
    if ev is None:
        ev = market_cap + total_debt - cash

    return MarketSnapshot(
        ticker=ticker.upper(),
        price=price,
        market_cap=market_cap,
        enterprise_value=ev,
        shares_outstanding=shares,
        total_debt=total_debt,
        cash=cash,
    )
