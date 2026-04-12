import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from app.services.financials_service import (
    get_eps_revenue,
    get_cash_data,
    get_order_backlog,
)
from app.models.schemas import EPSRevenueResponse, CashResponse, OrderBacklogResponse

def _make_mock_ticker():
    mock = MagicMock()

    dates = pd.to_datetime(["2024-03-31", "2023-12-31", "2023-09-30", "2023-06-30",
                             "2023-03-31", "2022-12-31", "2022-09-30", "2022-06-30"])
    mock.quarterly_earnings = pd.DataFrame({
        "Earnings": [3.0, 2.8, 2.5, 2.2, 2.9, 2.6, 2.3, 2.0],
        "Revenue": [1e11, 9.9e10, 9.8e10, 9.7e10, 9.6e10, 9.5e10, 9.4e10, 9.3e10],
    }, index=dates)

    bs_dates = pd.to_datetime(["2024-03-31", "2023-12-31", "2023-09-30", "2023-06-30"])
    mock.quarterly_balance_sheet = pd.DataFrame(
        {d: {
            "Cash And Cash Equivalents": 2e10,
            "Short Term Investments": 1e10,
        } for d in bs_dates}
    )

    fin_dates = pd.to_datetime(["2023-12-31", "2022-12-31", "2021-12-31"])
    mock.financials = pd.DataFrame(
        {d: {"Total Revenue": 3.85e11 - i * 1e10} for i, d in enumerate(fin_dates)}
    )
    return mock

@pytest.mark.anyio
async def test_get_eps_revenue_returns_schema():
    with patch("app.services.financials_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_eps_revenue("AAPL")
    assert isinstance(result, EPSRevenueResponse)
    assert result.ticker == "AAPL"
    assert len(result.quarterly_revenue) > 0
    assert len(result.quarterly_eps) > 0

@pytest.mark.anyio
async def test_get_cash_data_returns_schema():
    with patch("app.services.financials_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_cash_data("AAPL")
    assert isinstance(result, CashResponse)
    assert all(
        abs(r.total_liquid - (r.cash + r.short_term_investments)) < 0.01
        for r in result.quarterly
    )

@pytest.mark.anyio
async def test_get_order_backlog_returns_revenue_proxy():
    with patch("app.services.financials_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_order_backlog("AAPL")
    assert isinstance(result, OrderBacklogResponse)
    assert len(result.annual) >= 1
    assert "proxy" in result.note.lower()

@pytest.mark.anyio
async def test_get_eps_revenue_computes_yoy_delta():
    with patch("app.services.financials_service.yf.Ticker", return_value=_make_mock_ticker()):
        result = await get_eps_revenue("AAPL")
    # Should have non-None yoy delta for quarters that have a year-ago comparison
    quarters_with_delta = [q for q in result.quarterly_eps if q.eps_yoy_delta_pct is not None]
    assert len(quarters_with_delta) > 0
