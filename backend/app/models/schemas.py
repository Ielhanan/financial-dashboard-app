from pydantic import BaseModel
from typing import Optional

# --- Market ---

class MarketSnapshot(BaseModel):
    ticker: str
    price: float
    market_cap: float          # USD
    enterprise_value: float    # USD
    shares_outstanding: float
    total_debt: float
    cash: float
    change: float              # daily $ change
    change_pct: float          # daily % change
    market_cap_yoy: Optional[float]   # % YoY vs prior annual entry; None if unavailable
    total_debt_yoy: Optional[float]   # % YoY vs same quarter 1 year ago; None if unavailable

# --- Financials ---

class QuarterlyEPS(BaseModel):
    period: str          # "2024-Q1"
    eps_actual: Optional[float]
    eps_estimate: Optional[float]
    eps_yoy_delta_pct: Optional[float]

class QuarterlyRevenue(BaseModel):
    period: str
    revenue_actual: Optional[float]
    revenue_estimate: Optional[float]
    revenue_yoy_delta_pct: Optional[float]

class EPSRevenueResponse(BaseModel):
    ticker: str
    quarterly_eps: list[QuarterlyEPS]
    quarterly_revenue: list[QuarterlyRevenue]

class QuarterlyCash(BaseModel):
    period: str
    cash: float                # Cash and equivalents
    short_term_investments: float
    total_liquid: float        # cash + short_term_investments

class CashResponse(BaseModel):
    ticker: str
    quarterly: list[QuarterlyCash]

class AnnualBacklog(BaseModel):
    year: int
    revenue: float             # yfinance doesn't expose backlog; use revenue as proxy

class OrderBacklogResponse(BaseModel):
    ticker: str
    annual: list[AnnualBacklog]
    note: str = "Order backlog data unavailable via public API; annual revenue shown as proxy."

# --- Ratios ---

class RatioWithBenchmark(BaseModel):
    name: str
    value: Optional[float]
    sector_average: Optional[float]
    unit: str = "x"

class HistoricalRatio(BaseModel):
    year: int
    p_fcf: Optional[float]
    d_e: Optional[float]

class RatiosResponse(BaseModel):
    ticker: str
    current: list[RatioWithBenchmark]   # P/E, P/B, EV/EBITDA, P/FCF, D/E
    historical: list[HistoricalRatio]   # 5-year P/FCF and D/E trend

# --- Ownership & Dividends ---

class OwnershipRecord(BaseModel):
    holder: str
    shares: float
    pct_out: float
    holder_type: str   # "insider" | "institutional"

class OwnershipResponse(BaseModel):
    ticker: str
    insider_pct: float
    institutional_pct: float
    top_holders: list[OwnershipRecord]

class DividendRecord(BaseModel):
    date: str           # ISO date string
    amount: float
    yield_pct: Optional[float]
    ex_date: Optional[str]
    declaration_date: Optional[str]

class DividendResponse(BaseModel):
    ticker: str
    dividends: list[DividendRecord]

# --- News ---

class NewsItem(BaseModel):
    title: str
    publisher: str
    link: str
    published_at: str   # ISO datetime string
    summary: Optional[str]

class NewsResponse(BaseModel):
    ticker: str
    items: list[NewsItem]
