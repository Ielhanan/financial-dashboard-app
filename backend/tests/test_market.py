import pytest
from unittest.mock import patch, AsyncMock
from app.services.market_service import get_market_snapshot
from app.models.schemas import MarketSnapshot
from app.services import fmp_client

MOCK_QUOTE = {
    "price": 175.50,
    "marketCap": 2_700_000_000_000,
    "sharesOutstanding": 15_400_000_000,
}
MOCK_KEY_METRICS = {
    "enterpriseValue": 2_735_000_000_000,
}
MOCK_BALANCE_SHEETS_Q = [
    {
        "date": "2024-03-30",
        "cashAndCashEquivalents": 73_000_000_000,
        "shortTermInvestments": 39_000_000_000,
        "totalDebt": 108_000_000_000,
    }
]


@pytest.mark.anyio
async def test_get_market_snapshot_returns_schema():
    with (
        patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=MOCK_QUOTE)),
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_SHEETS_Q)),
    ):
        result = await get_market_snapshot("AAPL")

    assert isinstance(result, MarketSnapshot)
    assert result.ticker == "AAPL"
    assert result.price == 175.50
    assert result.market_cap == 2_700_000_000_000


@pytest.mark.anyio
async def test_get_market_snapshot_uses_ev_from_key_metrics():
    with (
        patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=MOCK_QUOTE)),
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_SHEETS_Q)),
    ):
        result = await get_market_snapshot("AAPL")

    assert result.enterprise_value == 2_735_000_000_000


@pytest.mark.anyio
async def test_market_rest_endpoint(client):
    with (
        patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=MOCK_QUOTE)),
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_SHEETS_Q)),
    ):
        response = await client.get("/api/market/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["price"] == 175.50
    assert "enterprise_value" in data
