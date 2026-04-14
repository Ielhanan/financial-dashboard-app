import pytest
from unittest.mock import patch, AsyncMock
from app.services.financials_service import get_eps_revenue, get_cash_data, get_order_backlog
from app.models.schemas import EPSRevenueResponse, CashResponse, OrderBacklogResponse
from app.services import fmp_client

# FMP returns newest-first; 8 quarters spanning 2 years for YoY testing
MOCK_INCOME_Q = [
    {"date": "2024-03-30", "revenue": 1.00e11, "eps": 3.0},
    {"date": "2023-12-31", "revenue": 9.9e10,  "eps": 2.8},
    {"date": "2023-09-30", "revenue": 9.8e10,  "eps": 2.5},
    {"date": "2023-06-30", "revenue": 9.7e10,  "eps": 2.2},
    {"date": "2023-03-31", "revenue": 9.6e10,  "eps": 2.9},
    {"date": "2022-12-31", "revenue": 9.5e10,  "eps": 2.6},
    {"date": "2022-09-30", "revenue": 9.4e10,  "eps": 2.3},
    {"date": "2022-06-30", "revenue": 9.3e10,  "eps": 2.0},
]

# FMP returns newest-first; older annual data not covered by quarterly years
MOCK_INCOME_A = [
    {"date": "2022-09-24", "revenue": 3.94e11, "eps": 6.15},
    {"date": "2021-09-25", "revenue": 3.66e11, "eps": 5.67},
]

MOCK_BALANCE_Q = [
    {"date": "2024-03-30", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
    {"date": "2023-12-31", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
    {"date": "2023-09-30", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
    {"date": "2023-06-30", "cashAndCashEquivalents": 2e10, "shortTermInvestments": 1e10},
]

MOCK_INCOME_A_BACKLOG = [
    {"date": "2023-12-31", "revenue": 3.85e11},
    {"date": "2022-12-31", "revenue": 3.75e11},
    {"date": "2021-12-31", "revenue": 3.65e11},
]


@pytest.mark.anyio
async def test_get_eps_revenue_returns_schema():
    with (
        patch.object(fmp_client, "get_income_statements_quarterly", new=AsyncMock(return_value=MOCK_INCOME_Q)),
        patch.object(fmp_client, "get_income_statements_annual", new=AsyncMock(return_value=MOCK_INCOME_A)),
    ):
        result = await get_eps_revenue("AAPL")
    assert isinstance(result, EPSRevenueResponse)
    assert result.ticker == "AAPL"
    assert len(result.quarterly_revenue) > 0
    assert len(result.quarterly_eps) > 0


@pytest.mark.anyio
async def test_get_eps_revenue_includes_annual_history():
    with (
        patch.object(fmp_client, "get_income_statements_quarterly", new=AsyncMock(return_value=MOCK_INCOME_Q)),
        patch.object(fmp_client, "get_income_statements_annual", new=AsyncMock(return_value=MOCK_INCOME_A)),
    ):
        result = await get_eps_revenue("AAPL")
    fy_periods = [r.period for r in result.quarterly_eps if r.period.startswith("FY")]
    assert len(fy_periods) > 0


@pytest.mark.anyio
async def test_get_eps_revenue_includes_projections():
    with (
        patch.object(fmp_client, "get_income_statements_quarterly", new=AsyncMock(return_value=MOCK_INCOME_Q)),
        patch.object(fmp_client, "get_income_statements_annual", new=AsyncMock(return_value=MOCK_INCOME_A)),
    ):
        result = await get_eps_revenue("AAPL")
    projected = [r for r in result.quarterly_eps if r.eps_actual is None and r.eps_estimate is not None]
    assert len(projected) == 4


@pytest.mark.anyio
async def test_get_eps_revenue_computes_yoy_delta():
    with (
        patch.object(fmp_client, "get_income_statements_quarterly", new=AsyncMock(return_value=MOCK_INCOME_Q)),
        patch.object(fmp_client, "get_income_statements_annual", new=AsyncMock(return_value=MOCK_INCOME_A)),
    ):
        result = await get_eps_revenue("AAPL")
    quarters_with_delta = [q for q in result.quarterly_eps if q.eps_yoy_delta_pct is not None]
    assert len(quarters_with_delta) > 0


@pytest.mark.anyio
async def test_get_cash_data_returns_schema():
    with (
        patch.object(fmp_client, "get_balance_sheets_quarterly", new=AsyncMock(return_value=MOCK_BALANCE_Q)),
    ):
        result = await get_cash_data("AAPL")
    assert isinstance(result, CashResponse)
    assert all(
        abs(r.total_liquid - (r.cash + r.short_term_investments)) < 0.01
        for r in result.quarterly
    )


@pytest.mark.anyio
async def test_get_order_backlog_returns_revenue_proxy():
    with (
        patch.object(fmp_client, "get_income_statements_annual", new=AsyncMock(return_value=MOCK_INCOME_A_BACKLOG)),
    ):
        result = await get_order_backlog("AAPL")
    assert isinstance(result, OrderBacklogResponse)
    assert len(result.annual) >= 1
    assert "proxy" in result.note.lower()
