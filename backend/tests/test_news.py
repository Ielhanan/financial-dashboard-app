import pytest
from unittest.mock import patch, MagicMock
from app.services.news_service import get_news
from app.models.schemas import NewsResponse

MOCK_NEWS = [
    {
        "title": "Apple Reports Record Revenue",
        "publisher": "Reuters",
        "link": "https://reuters.com/article/123",
        "providerPublishTime": 1704067200,  # 2024-01-01 00:00:00 UTC
        "summary": "Apple Inc reported record revenue for Q4.",
    },
    {
        "title": "Apple Launches New iPhone",
        "publisher": "Bloomberg",
        "link": "https://bloomberg.com/article/456",
        "providerPublishTime": 1703980800,
        "summary": None,
    },
]

@pytest.mark.anyio
async def test_get_news_returns_schema():
    mock_ticker = MagicMock()
    mock_ticker.news = MOCK_NEWS
    with patch("app.services.news_service.yf.Ticker", return_value=mock_ticker):
        result = await get_news("AAPL")
    assert isinstance(result, NewsResponse)
    assert result.ticker == "AAPL"
    assert len(result.items) == 2

@pytest.mark.anyio
async def test_get_news_parses_fields():
    mock_ticker = MagicMock()
    mock_ticker.news = MOCK_NEWS
    with patch("app.services.news_service.yf.Ticker", return_value=mock_ticker):
        result = await get_news("AAPL")
    first = result.items[0]
    assert first.title == "Apple Reports Record Revenue"
    assert first.publisher == "Reuters"
    assert first.link == "https://reuters.com/article/123"
    assert "2024" in first.published_at
    assert first.summary == "Apple Inc reported record revenue for Q4."

@pytest.mark.anyio
async def test_get_news_handles_empty():
    mock_ticker = MagicMock()
    mock_ticker.news = []
    with patch("app.services.news_service.yf.Ticker", return_value=mock_ticker):
        result = await get_news("AAPL")
    assert result.items == []

@pytest.mark.anyio
async def test_get_news_caps_at_30():
    mock_ticker = MagicMock()
    mock_ticker.news = [{"title": f"Article {i}", "publisher": "X", "link": "http://x.com",
                          "providerPublishTime": 1704067200, "summary": None}
                        for i in range(50)]
    with patch("app.services.news_service.yf.Ticker", return_value=mock_ticker):
        result = await get_news("AAPL")
    assert len(result.items) <= 30
