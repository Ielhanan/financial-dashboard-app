from fastapi import APIRouter
from app.services.ratios_service import get_ratios

router = APIRouter(prefix="/api/ratios", tags=["ratios"])

@router.get("/{ticker}")
async def ratios(ticker: str):
    return await get_ratios(ticker.upper())
