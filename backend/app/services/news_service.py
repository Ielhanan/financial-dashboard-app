import logging
from app.models.schemas import NewsResponse, NewsItem
from app.services import fmp_client

logger = logging.getLogger(__name__)


async def get_news(ticker: str) -> NewsResponse:
    try:
        return await _get_news_inner(ticker)
    except Exception as exc:
        logger.warning("get_news failed for %s: %s", ticker, exc)
        return NewsResponse(ticker=ticker.upper(), items=[])


async def _get_news_inner(ticker: str) -> NewsResponse:
    articles = await fmp_client.get_news(ticker)

    items = [
        NewsItem(
            title=a.get("title", ""),
            publisher=a.get("site", ""),
            link=a.get("url", ""),
            published_at=a.get("publishedDate", ""),
            summary=a.get("text") or None,
        )
        for a in articles[:30]
    ]

    return NewsResponse(ticker=ticker.upper(), items=items)
