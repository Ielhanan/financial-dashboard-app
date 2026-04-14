import asyncio
import logging
from app.models.schemas import MarketSnapshot
from app.services import fmp_client

logger = logging.getLogger(__name__)


async def get_market_snapshot(ticker: str) -> MarketSnapshot:
    try:
        quote, metrics, balance_sheets = await asyncio.gather(
            fmp_client.get_quote(ticker),
            fmp_client.get_key_metrics(ticker),
            fmp_client.get_balance_sheets_quarterly(ticker),
        )

        price = float(quote.get("price") or 0.0)
        market_cap = float(quote.get("marketCap") or 0.0)
        shares = round(market_cap / price, 0) if price > 0 else 0.0
        ev = float(metrics.get("enterpriseValue") or market_cap)

        latest = balance_sheets[0] if balance_sheets else {}
        total_debt = float(latest.get("totalDebt") or 0.0)
        cash = float(latest.get("cashAndCashEquivalents") or 0.0)

        return MarketSnapshot(
            ticker=ticker.upper(),
            price=price,
            market_cap=market_cap,
            enterprise_value=ev,
            shares_outstanding=shares,
            total_debt=total_debt,
            cash=cash,
        )
    except Exception as exc:
        logger.warning("market_service failed for %s: %s", ticker, exc)
        return MarketSnapshot(
            ticker=ticker.upper(),
            price=0.0, market_cap=0.0, enterprise_value=0.0,
            shares_outstanding=0.0, total_debt=0.0, cash=0.0,
        )
