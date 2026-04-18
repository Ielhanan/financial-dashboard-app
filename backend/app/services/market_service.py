import asyncio
import logging
from app.models.schemas import MarketSnapshot
from app.services import fmp_client

logger = logging.getLogger(__name__)


async def get_market_snapshot(ticker: str) -> MarketSnapshot:
    try:
        quote, key_metrics_list, balance_sheets = await asyncio.gather(
            fmp_client.get_quote(ticker),
            fmp_client.get_key_metrics_annual(ticker),
            fmp_client.get_balance_sheets_quarterly(ticker),
        )

        price = float(quote.get("price") or 0.0)
        market_cap = float(quote.get("marketCap") or 0.0)
        shares = round(market_cap / price, 0) if price > 0 else 0.0

        latest_metrics = key_metrics_list[0] if key_metrics_list else {}
        ev = float(latest_metrics.get("enterpriseValue") or market_cap)

        latest_sheet = balance_sheets[0] if balance_sheets else {}
        total_debt = float(latest_sheet.get("totalDebt") or 0.0)
        cash = float(latest_sheet.get("cashAndCashEquivalents") or 0.0)

        change = float(quote.get("change") or 0.0)
        change_pct = float(quote.get("changesPercentage") or 0.0)

        market_cap_yoy = None
        if len(key_metrics_list) >= 2:
            prior_mc = float(key_metrics_list[1].get("marketCap") or 0.0)
            if prior_mc > 0:
                market_cap_yoy = round((market_cap / prior_mc - 1) * 100, 1)

        total_debt_yoy = None
        if len(balance_sheets) >= 5:
            prior_debt = float(balance_sheets[4].get("totalDebt") or 0.0)
            if prior_debt > 0:
                total_debt_yoy = round((total_debt / prior_debt - 1) * 100, 1)

        return MarketSnapshot(
            ticker=ticker.upper(),
            price=price,
            market_cap=market_cap,
            enterprise_value=ev,
            shares_outstanding=shares,
            total_debt=total_debt,
            cash=cash,
            change=change,
            change_pct=change_pct,
            market_cap_yoy=market_cap_yoy,
            total_debt_yoy=total_debt_yoy,
        )
    except Exception as exc:
        logger.warning("market_service failed for %s: %s", ticker, exc)
        return MarketSnapshot(
            ticker=ticker.upper(),
            price=0.0, market_cap=0.0, enterprise_value=0.0,
            shares_outstanding=0.0, total_debt=0.0, cash=0.0,
            change=0.0, change_pct=0.0,
            market_cap_yoy=None, total_debt_yoy=None,
        )
