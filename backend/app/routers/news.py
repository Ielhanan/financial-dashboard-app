from fastapi import APIRouter
from app.services.news_service import get_news

router = APIRouter(prefix="/api/news", tags=["news"])

@router.get("/{ticker}")
async def news(ticker: str):
    return await get_news(ticker.upper())
