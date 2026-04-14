import pytest
from unittest.mock import patch, AsyncMock
from app.services.news_service import get_news
from app.models.schemas import NewsResponse
from app.services import fmp_client

MOCK_NEWS = [
    {
        "title": "Apple Reports Record Revenue",
        "site": "Reuters",
        "url": "https://reuters.com/article/123",
        "publishedDate": "2024-01-01 00:00:00",
        "text": "Apple Inc reported record revenue for Q4.",
    },
    {
        "title": "Apple Launches New iPhone",
        "site": "Bloomberg",
        "url": "https://bloomberg.com/article/456",
        "publishedDate": "2023-12-31 12:00:00",
        "text": None,
    },
]


@pytest.mark.anyio
async def test_get_news_returns_schema():
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=MOCK_NEWS)):
        result = await get_news("AAPL")
    assert isinstance(result, NewsResponse)
    assert result.ticker == "AAPL"
    assert len(result.items) == 2


@pytest.mark.anyio
async def test_get_news_parses_fields():
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=MOCK_NEWS)):
        result = await get_news("AAPL")
    first = result.items[0]
    assert first.title == "Apple Reports Record Revenue"
    assert first.publisher == "Reuters"
    assert first.link == "https://reuters.com/article/123"
    assert "2024" in first.published_at
    assert first.summary == "Apple Inc reported record revenue for Q4."


@pytest.mark.anyio
async def test_get_news_handles_empty():
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=[])):
        result = await get_news("AAPL")
    assert result.items == []


@pytest.mark.anyio
async def test_get_news_caps_at_30():
    big_feed = [
        {"title": f"Article {i}", "site": "X", "url": "http://x.com",
         "publishedDate": "2024-01-01 00:00:00", "text": None}
        for i in range(50)
    ]
    with patch.object(fmp_client, "get_news", new=AsyncMock(return_value=big_feed)):
        result = await get_news("AAPL")
    assert len(result.items) <= 30
