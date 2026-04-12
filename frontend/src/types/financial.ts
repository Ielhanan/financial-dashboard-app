export interface MarketSnapshot {
  ticker: string;
  price: number;
  market_cap: number;
  enterprise_value: number;
  shares_outstanding: number;
  total_debt: number;
  cash: number;
}

export interface QuarterlyEPS {
  period: string;
  eps_actual: number | null;
  eps_estimate: number | null;
  eps_yoy_delta_pct: number | null;
}

export interface QuarterlyRevenue {
  period: string;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  revenue_yoy_delta_pct: number | null;
}

export interface EPSRevenueResponse {
  ticker: string;
  quarterly_eps: QuarterlyEPS[];
  quarterly_revenue: QuarterlyRevenue[];
}

export interface QuarterlyCash {
  period: string;
  cash: number;
  short_term_investments: number;
  total_liquid: number;
}

export interface CashResponse {
  ticker: string;
  quarterly: QuarterlyCash[];
}

export interface AnnualBacklog {
  year: number;
  revenue: number;
}

export interface OrderBacklogResponse {
  ticker: string;
  annual: AnnualBacklog[];
  note: string;
}

export interface RatioWithBenchmark {
  name: string;
  value: number | null;
  sector_average: number | null;
  unit: string;
}

export interface HistoricalRatio {
  year: number;
  p_fcf: number | null;
  d_e: number | null;
}

export interface RatiosResponse {
  ticker: string;
  current: RatioWithBenchmark[];
  historical: HistoricalRatio[];
}

export interface OwnershipRecord {
  holder: string;
  shares: number;
  pct_out: number;
  holder_type: string;
}

export interface OwnershipResponse {
  ticker: string;
  insider_pct: number;
  institutional_pct: number;
  top_holders: OwnershipRecord[];
}

export interface DividendRecord {
  date: string;
  amount: number;
  yield_pct: number | null;
  ex_date: string | null;
  declaration_date: string | null;
}

export interface DividendResponse {
  ticker: string;
  dividends: DividendRecord[];
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  published_at: string;
  summary: string | null;
}

export interface NewsResponse {
  ticker: string;
  items: NewsItem[];
}
