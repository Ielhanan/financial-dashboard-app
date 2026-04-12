from fastapi import APIRouter
from app.services.financials_service import get_eps_revenue, get_cash_data, get_order_backlog

router = APIRouter(prefix="/api/financials", tags=["financials"])

@router.get("/{ticker}/eps-revenue")
async def eps_revenue(ticker: str):
    return await get_eps_revenue(ticker.upper())

@router.get("/{ticker}/cash")
async def cash(ticker: str):
    return await get_cash_data(ticker.upper())

@router.get("/{ticker}/order-backlog")
async def order_backlog(ticker: str):
    return await get_order_backlog(ticker.upper())
