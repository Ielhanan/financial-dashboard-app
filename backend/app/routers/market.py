import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.market_service import get_market_snapshot
from app.config import settings

router = APIRouter(prefix="/api", tags=["market"])

@router.get("/market/{ticker}")
async def get_market(ticker: str):
    return await get_market_snapshot(ticker.upper())

@router.websocket("/ws/market/{ticker}")
async def market_websocket(websocket: WebSocket, ticker: str):
    await websocket.accept()
    try:
        while True:
            snapshot = await get_market_snapshot(ticker.upper())
            await websocket.send_text(snapshot.model_dump_json())
            await asyncio.sleep(settings.ws_update_interval_seconds)
    except WebSocketDisconnect:
        pass
