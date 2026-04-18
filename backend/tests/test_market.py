import pytest
from contextlib import ExitStack
from unittest.mock import patch, AsyncMock
from app.services.market_service import get_market_snapshot
from app.models.schemas import MarketSnapshot
from app.services import fmp_client

MOCK_QUOTE = {
    "price": 175.50,
    "marketCap": 2_700_000_000_000,
    "sharesOutstanding": 15_400_000_000,
    "change": 3.45,
    "changesPercentage": 2.01,
}
MOCK_KEY_METRICS_LIST = [
    {"enterpriseValue": 2_735_000_000_000, "marketCap": 2_700_000_000_000},
    {"enterpriseValue": 2_500_000_000_000, "marketCap": 2_500_000_000_000},
]
MOCK_BALANCE_SHEETS_Q = [
    {"date": "2024-03-30", "cashAndCashEquivalents": 73_000_000_000, "totalDebt": 108_000_000_000},
    {"date": "2023-12-30", "cashAndCashEquivalents": 70_000_000_000, "totalDebt": 110_000_000_000},
    {"date": "2023-09-30", "cashAndCashEquivalents": 68_000_000_000, "totalDebt": 112_000_000_000},
    {"date": "2023-06-30", "cashAndCashEquivalents": 65_000_000_000, "totalDebt": 115_000_000_000},
    {"date": "2023-03-30", "cashAndCashEquivalents": 63_000_000_000, "totalDebt": 120_000_000_000},
]


class _patch_all:
    def __init__(self, quote=MOCK_QUOTE, metrics=MOCK_KEY_METRICS_LIST, sheets=MOCK_BALANCE_SHEETS_Q):
        self._patches = (
            patch.object(fmp_client, "get_quote", new=AsyncMock(return_value=quote)),
            patch.object(fmp_client, "get_key_metrics_annual", new=AsyncMock(return_value=metrics)),
            patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=sheets)),
        )
        self._stack = ExitStack()

    def __enter__(self):
        for p in self._patches:
            self._stack.enter_context(p)
        return self

    def __exit__(self, *args):
        return self._stack.__exit__(*args)


@pytest.mark.anyio
async def test_get_market_snapshot_returns_schema():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    assert isinstance(result, MarketSnapshot)
    assert result.ticker == "AAPL"
    assert result.price == 175.50
    assert result.market_cap == 2_700_000_000_000


@pytest.mark.anyio
async def test_get_market_snapshot_uses_ev_from_key_metrics():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    assert result.enterprise_value == 2_735_000_000_000


@pytest.mark.anyio
async def test_get_market_snapshot_daily_change():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    assert result.change == 3.45
    assert result.change_pct == 2.01


@pytest.mark.anyio
async def test_get_market_snapshot_market_cap_yoy():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    # (2_700B / 2_500B - 1) * 100 = 8.0%
    assert result.market_cap_yoy == pytest.approx(8.0, rel=0.01)


@pytest.mark.anyio
async def test_get_market_snapshot_market_cap_yoy_none_when_single_entry():
    with _patch_all(metrics=[MOCK_KEY_METRICS_LIST[0]]):
        result = await get_market_snapshot("AAPL")

    assert result.market_cap_yoy is None


@pytest.mark.anyio
async def test_get_market_snapshot_total_debt_yoy():
    with _patch_all():
        result = await get_market_snapshot("AAPL")

    # (108B / 120B - 1) * 100 = -10.0%
    assert result.total_debt_yoy == pytest.approx(-10.0, rel=0.01)


@pytest.mark.anyio
async def test_get_market_snapshot_total_debt_yoy_none_when_fewer_than_5_sheets():
    with _patch_all(sheets=MOCK_BALANCE_SHEETS_Q[:3]):
        result = await get_market_snapshot("AAPL")

    assert result.total_debt_yoy is None


@pytest.mark.anyio
async def test_market_rest_endpoint(client):
    with _patch_all():
        response = await client.get("/api/market/AAPL")

    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "AAPL"
    assert data["price"] == 175.50
    assert "enterprise_value" in data
    assert "change" in data
    assert "market_cap_yoy" in data
