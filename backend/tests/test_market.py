import pytest
from unittest.mock import patch, MagicMock
from app.services.market_service import get_market_snapshot
from app.models.schemas import MarketSnapshot

MOCK_INFO = {
    "currentPrice": 175.50,
    "marketCap": 2_700_000_000_000,
    "sharesOutstanding": 15_400_000_000,
    "totalDebt": 108_000_000_000,
    "totalCash": 73_000_000_000,
    "enterpriseValue": 2_735_000_000_000,
}

@pytest.mark.anyio
async def test_get_market_snapshot_returns_schema():
    with patch("app.services.market_service.yf.Ticker") as mock_ticker_cls:
        mock_ticker = MagicMock()
        mock_ticker.info = MOCK_INFO
        mock_ticker_cls.return_value = mock_ticker

        result = await get_market_snapshot("AAPL")

    assert isinstance(result, MarketSnapshot)
    assert result.ticker == "AAPL"
    assert result.price == 175.50
    assert result.market_cap == 2_700_000_000_000

@pytest.mark.anyio
async def test_get_market_snapshot_computes_ev_when_missing():
    info_no_ev = {**MOCK_INFO, "enterpriseValue": None}
    with patch("app.services.market_service.yf.Ticker") as mock_ticker_cls:
        mock_ticker = MagicMock()
        mock_ticker.info = info_no_ev
        mock_ticker_cls.return_value = mock_ticker

        result = await get_market_snapshot("AAPL")

    expected_ev = MOCK_INFO["marketCap"] + MOCK_INFO["totalDebt"] - MOCK_INFO["totalCash"]
    assert result.enterprise_value == expected_ev

@pytest.mark.anyio
async def test_market_rest_endpoint(client):
    with patch("app.services.market_service.yf.Ticker") as mock_ticker_cls:
        mock_ticker = MagicMock()
        mock_ticker.info = MOCK_INFO
        mock_ticker_cls.return_value = mock_ticker

        response = await client.get("/api/market/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["price"] == 175.50
    assert "enterprise_value" in data
