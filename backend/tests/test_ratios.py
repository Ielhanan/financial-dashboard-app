import pytest
from unittest.mock import patch, AsyncMock
from app.services.ratios_service import get_ratios
from app.models.schemas import RatiosResponse
from app.services import fmp_client

MOCK_KEY_METRICS = {
    "peRatio": 28.5,
    "pbRatio": 45.2,
    "enterpriseValueOverEBITDA": 22.1,
    "pfcfRatio": 27.0,
    "debtToEquity": 1.5,
    "enterpriseValue": 2_735_000_000_000,
    "marketCap": 2_700_000_000_000,
}

MOCK_PROFILE = {"sector": "Technology"}

# FMP returns newest-first
MOCK_CASH_FLOW_A = [
    {"date": "2023-12-31", "freeCashFlow": 9.9e10},
    {"date": "2022-12-31", "freeCashFlow": 9.5e10},
    {"date": "2021-12-31", "freeCashFlow": 9.3e10},
    {"date": "2020-12-31", "freeCashFlow": 8.0e10},
    {"date": "2019-12-31", "freeCashFlow": 7.5e10},
]

MOCK_BALANCE_A = [
    {"date": "2023-12-31", "totalDebt": 1.08e11, "totalStockholdersEquity": 6.2e10},
    {"date": "2022-12-31", "totalDebt": 1.10e11, "totalStockholdersEquity": 5.8e10},
    {"date": "2021-12-31", "totalDebt": 1.22e11, "totalStockholdersEquity": 6.3e10},
    {"date": "2020-12-31", "totalDebt": 1.12e11, "totalStockholdersEquity": 6.5e10},
    {"date": "2019-12-31", "totalDebt": 1.08e11, "totalStockholdersEquity": 9.0e10},
]


def _patch_all():
    return (
        patch.object(fmp_client, "get_key_metrics", new=AsyncMock(return_value=MOCK_KEY_METRICS)),
        patch.object(fmp_client, "get_profile", new=AsyncMock(return_value=MOCK_PROFILE)),
        patch.object(fmp_client, "get_cash_flow_annual", new=AsyncMock(return_value=MOCK_CASH_FLOW_A)),
        patch.object(fmp_client, "get_balance_sheets_annual", new=AsyncMock(return_value=MOCK_BALANCE_A)),
    )


@pytest.mark.anyio
async def test_get_ratios_returns_schema():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    assert isinstance(result, RatiosResponse)
    assert result.ticker == "AAPL"


@pytest.mark.anyio
async def test_get_ratios_has_five_current_ratios():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    names = [r.name for r in result.current]
    assert "P/E" in names
    assert "P/B" in names
    assert "EV/EBITDA" in names
    assert "P/FCF" in names
    assert "D/E" in names


@pytest.mark.anyio
async def test_get_ratios_historical_has_five_years():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    assert len(result.historical) == 5


@pytest.mark.anyio
async def test_get_ratios_sector_benchmark_technology():
    with _patch_all()[0], _patch_all()[1], _patch_all()[2], _patch_all()[3]:
        result = await get_ratios("AAPL")
    pe_ratio = next(r for r in result.current if r.name == "P/E")
    assert pe_ratio.sector_average == 28.0  # Technology PE benchmark
