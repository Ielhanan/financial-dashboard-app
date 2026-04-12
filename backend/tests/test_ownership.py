import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from app.services.ownership_service import get_ownership, get_dividends
from app.models.schemas import OwnershipResponse, DividendResponse

def _make_mock_ticker():
    mock = MagicMock()
    mock.info = {
        "heldPercentInsiders": 0.03,
        "heldPercentInstitutions": 0.62,
        "trailingAnnualDividendYield": 0.0054,
    }
    mock.institutional_holders = pd.DataFrame({
        "Holder": ["Vanguard Group", "BlackRock"],
        "Shares": [1_200_000_000, 1_000_000_000],
        "% Out": [0.079, 0.065],
    })
    dates = pd.to_datetime(["2024-02-09", "2023-11-10", "2023-08-11", "2023-05-12"])
    mock.dividends = pd.Series([0.24, 0.24, 0.24, 0.24], index=dates, name="Dividends")
    return mock

@pytest.mark.anyio
async def test_get_ownership_returns_schema():
    with patch("app.services.ownership_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_ownership("AAPL")
    assert isinstance(result, OwnershipResponse)
    assert result.ticker == "AAPL"
    assert 0 <= result.insider_pct <= 100
    assert 0 <= result.institutional_pct <= 100
    assert len(result.top_holders) == 2

@pytest.mark.anyio
async def test_get_ownership_percentages_correct():
    with patch("app.services.ownership_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_ownership("AAPL")
    assert result.insider_pct == 3.0      # 0.03 * 100
    assert result.institutional_pct == 62.0  # 0.62 * 100

@pytest.mark.anyio
async def test_get_dividends_returns_schema():
    with patch("app.services.ownership_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_dividends("AAPL")
    assert isinstance(result, DividendResponse)
    assert len(result.dividends) == 4
    assert result.dividends[0].amount == 0.24

@pytest.mark.anyio
async def test_get_dividends_filters_to_five_years():
    mock = _make_mock_ticker()
    # Add an old dividend outside the 5-year window
    old_date = pd.Timestamp("2018-01-01")
    new_dates = pd.to_datetime(["2024-02-09", "2023-11-10"])
    all_dates = pd.DatetimeIndex(pd.concat([pd.Series(new_dates), pd.Series([old_date])]))
    mock.dividends = pd.Series([0.24, 0.24, 0.20], index=all_dates, name="Dividends")

    with patch("app.services.ownership_service.yf.Ticker", return_value=mock):
        result = await get_dividends("AAPL")
    # Only the 2 recent ones should be returned (old_date is > 5 years before max)
    assert len(result.dividends) <= 3
