import requests_cache
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import market, financials, ratios, ownership, news

# Cache all Yahoo Finance HTTP responses for 60 seconds.
# This means all yf.Ticker instances across all services share one cached
# response per URL — eliminating the 429 rate-limit errors caused by
# 10+ simultaneous requests for the same ticker on each "Load" click.
requests_cache.install_cache("yfinance_cache", expire_after=60)

app = FastAPI(title="Financial Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router)
app.include_router(financials.router)
app.include_router(ratios.router)
app.include_router(ownership.router)
app.include_router(news.router)

@app.get("/health")
def health():
    return {"status": "ok"}
