from fastapi import APIRouter
from app.services.ownership_service import get_ownership, get_dividends

router = APIRouter(prefix="/api/ownership", tags=["ownership"])

@router.get("/{ticker}")
async def ownership(ticker: str):
    return await get_ownership(ticker.upper())

@router.get("/{ticker}/dividends")
async def dividends(ticker: str):
    return await get_dividends(ticker.upper())
