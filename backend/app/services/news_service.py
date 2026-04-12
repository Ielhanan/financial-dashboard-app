import asyncio
import logging
from datetime import datetime
import yfinance as yf
from app.models.schemas import NewsResponse, NewsItem

logger = logging.getLogger(__name__)


async def get_news(ticker: str) -> NewsResponse:
    try:
        return await _get_news_inner(ticker)
    except Exception as exc:
        logger.warning("get_news failed for %s: %s", ticker, exc)
        return NewsResponse(ticker=ticker.upper(), items=[])


async def _get_news_inner(ticker: str) -> NewsResponse:
    loop = asyncio.get_event_loop()
    t = await loop.run_in_executor(None, lambda: yf.Ticker(ticker))

    raw_news = t.news or []
    items: list[NewsItem] = []

    for article in raw_news[:30]:
        published_at = datetime.fromtimestamp(
            article.get("providerPublishTime", 0)
        ).isoformat()

        items.append(NewsItem(
            title=article.get("title", ""),
            publisher=article.get("publisher", ""),
            link=article.get("link", ""),
            published_at=published_at,
            summary=article.get("summary"),
        ))

    return NewsResponse(ticker=ticker.upper(), items=items)
