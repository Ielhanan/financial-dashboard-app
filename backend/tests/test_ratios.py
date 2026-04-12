import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from app.services.ratios_service import get_ratios
from app.models.schemas import RatiosResponse

MOCK_INFO = {
    "trailingPE": 28.5,
    "priceToBook": 45.2,
    "enterpriseToEbitda": 22.1,
    "freeCashflow": 90_000_000_000,
    "marketCap": 2_700_000_000_000,
    "totalDebt": 108_000_000_000,
    "totalStockholderEquity": 62_000_000_000,
    "sector": "Technology",
}

def _make_mock_ticker():
    mock = MagicMock()
    mock.info = MOCK_INFO
    dates = pd.to_datetime(["2023-12-31", "2022-12-31", "2021-12-31", "2020-12-31", "2019-12-31"])
    mock.cashflow = pd.DataFrame(
        {d: {
            "Total Cash From Operating Activities": 1e11 + i * 1e9,
            "Capital Expenditures": -1e10,
        } for i, d in enumerate(dates)}
    )
    mock.balance_sheet = pd.DataFrame(
        {d: {
            "Total Debt": 1e11,
            "Total Stockholder Equity": 6e10,
        } for i, d in enumerate(dates)}
    )
    return mock

@pytest.mark.anyio
async def test_get_ratios_returns_schema():
    with patch("app.services.ratios_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_ratios("AAPL")
    assert isinstance(result, RatiosResponse)
    assert result.ticker == "AAPL"

@pytest.mark.anyio
async def test_get_ratios_has_five_current_ratios():
    with patch("app.services.ratios_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_ratios("AAPL")
    names = [r.name for r in result.current]
    assert "P/E" in names
    assert "P/B" in names
    assert "EV/EBITDA" in names
    assert "P/FCF" in names
    assert "D/E" in names

@pytest.mark.anyio
async def test_get_ratios_historical_has_five_years():
    with patch("app.services.ratios_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_ratios("AAPL")
    assert len(result.historical) == 5

@pytest.mark.anyio
async def test_get_ratios_sector_benchmark_technology():
    with patch("app.services.ratios_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_ratios("AAPL")
    pe_ratio = next(r for r in result.current if r.name == "P/E")
    assert pe_ratio.sector_average == 28.0   # Technology PE benchmark
