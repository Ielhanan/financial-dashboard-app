import pytest
from unittest.mock import patch, AsyncMock
from app.services.ownership_service import get_ownership, get_dividends
from app.models.schemas import OwnershipResponse, DividendResponse
from app.services import fmp_client

MOCK_HOLDERS = [
    {"holder": "Vanguard Group", "shares": 1_200_000_000, "sharesPercent": 0.079},
    {"holder": "BlackRock",      "shares": 1_000_000_000, "sharesPercent": 0.065},
]

# FMP returns newest-first
MOCK_DIVIDENDS = [
    {"date": "2024-02-09", "dividend": 0.24, "recordDate": "2024-02-12", "declarationDate": "2024-02-01"},
    {"date": "2023-11-10", "dividend": 0.24, "recordDate": "2023-11-13", "declarationDate": "2023-11-02"},
    {"date": "2023-08-11", "dividend": 0.24, "recordDate": "2023-08-14", "declarationDate": "2023-08-03"},
    {"date": "2023-05-12", "dividend": 0.24, "recordDate": "2023-05-15", "declarationDate": "2023-05-04"},
]

MOCK_DIVIDENDS_WITH_OLD = [
    {"date": "2024-02-09", "dividend": 0.24, "recordDate": None, "declarationDate": None},
    {"date": "2023-11-10", "dividend": 0.24, "recordDate": None, "declarationDate": None},
    {"date": "2018-01-01", "dividend": 0.20, "recordDate": None, "declarationDate": None},
]


@pytest.mark.anyio
async def test_get_ownership_returns_schema():
    with patch.object(fmp_client, "get_institutional_holders", new=AsyncMock(return_value=MOCK_HOLDERS)):
        result = await get_ownership("AAPL")
    assert isinstance(result, OwnershipResponse)
    assert result.ticker == "AAPL"
    assert 0 <= result.insider_pct <= 100
    assert 0 <= result.institutional_pct <= 100
    assert len(result.top_holders) == 2


@pytest.mark.anyio
async def test_get_ownership_percentages_correct():
    with patch.object(fmp_client, "get_institutional_holders", new=AsyncMock(return_value=MOCK_HOLDERS)):
        result = await get_ownership("AAPL")
    # insider_pct is 0.0 — not available on FMP free tier
    assert result.insider_pct == 0.0
    # institutional_pct = sum of sharesPercent * 100 = (0.079 + 0.065) * 100 = 14.4
    assert abs(result.institutional_pct - 14.4) < 0.01


@pytest.mark.anyio
async def test_get_dividends_returns_schema():
    with patch.object(fmp_client, "get_dividends", new=AsyncMock(return_value=MOCK_DIVIDENDS)):
        result = await get_dividends("AAPL")
    assert isinstance(result, DividendResponse)
    assert len(result.dividends) == 4
    assert result.dividends[0].amount == 0.24


@pytest.mark.anyio
async def test_get_dividends_filters_to_five_years():
    with patch.object(fmp_client, "get_dividends", new=AsyncMock(return_value=MOCK_DIVIDENDS_WITH_OLD)):
        result = await get_dividends("AAPL")
    # 2018-01-01 is outside the 5-year window from today (2026-04-13)
    assert len(result.dividends) == 2
