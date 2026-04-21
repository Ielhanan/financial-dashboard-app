# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Project:** Stock Financial Monitoring Dashboard (Web Dashboard for Financial Analysis)  
**Version:** 1.0  
**Status:** Final version for implementation  

---

## 1. Introduction

### 1.1 Purpose of the Document
This document defines the functional and technical requirements for the "Financial Dashboard" web application. This document serves as a baseline guide for the developer to implement the business logic, interface, and data structure.

### 1.2 System Overview
The application is a platform for deep fundamental analysis of public companies. The system integrates market data, financial statements, multiples, and news, providing the user with dynamic visualization tools covering a 5-year historical horizon.

---

## 2. Functional Requirements

### 2.1 Market Performance Module (Real-Time)
The system must display core cost metrics in real-time.

| Parameter | Formula / Source | Visualization Requirements |
| :--- | :--- | :--- |
| **Market Capitalization (MC)** | $Price \times Shares Outstanding$ | Real-time USD value displayed next to the stock ticker. |
| **Enterprise Value (EV)** | $MC + Debt - Cash$ | Real-time USD value. |

### 2.2 Financial Reporting and Forecasting Module
Historical data for the **last 5 years** must be displayed for all parameters in this group.

* **Order Backlog (Book of Orders):**
    * Visualization: "Year / Order Amount" chart with a planning horizon for several years ahead.
* **Earnings Per Share (EPS) and Revenue:**
    * Comparison: Forecast vs. Actual (quarterly).
    * Delta calculation: % change relative to the same period of the previous year.
    * **Forecast:** Indicate projected EPS and Revenue for 1 year (4 quarters) ahead.
    * Visualization: Combination of table and chart.
* **Cash and Cash Equivalents:**
    * Includes: Cash, short-term instruments, and Treasury bills.
    * Visualization: Quarterly table and trend chart.

### 2.3 Ratios and Multipliers
For contextual analysis, all ratios must include a comparison with the **sector/industry average**.

* **P/E, P/B, EV/EBITDA:** Current values + industry benchmark.
* **P/FCF (Price to Free Cash Flow):** $FCF = Operating Cash Flow - CapEx$.
    * Visualization: Table and chart with a 5-year retrospective.
* **Debt-to-Equity (D/E) Ratio:** * $Total Debt = Short-term + Long-term Liabilities$
    * $Equity = Assets - Liabilities$
    * Preview: Debt load trend chart.

### 2.4 Ownership Structure and Dividends
* **Insider and Institutional Ownership:** Ownership percentage held by top management and funds.
    * Visualization: Table of changes over 5 years.
* **Dividend Policy:**
    * Table: Declaration Date, Ex-Dividend Date, Amount per Share, Yield (%).
    * Visualization: 5-year payment schedule chart.

### 2.5 News Aggregator
Integration of news feeds based on a specific ticker.
* **Sources:** Finviz, Investing.com, WSJ, Yahoo Finance, Barron's, and others.
* **Content:** M&A, insider deals, analytical reports, corporate events.

---

## 3. UI/UX Requirements
1.  **Interactivity:** All graphical elements must support Zoom and display precise values on hover (Tooltip).
2.  **Table View:** Ability to export data from tables in CSV/Excel formats.
3.  **Synchronization:** When a ticker is selected, all modules (from MC to news) must update instantly.

---

## 4. Technical and Non-Functional Requirements
* **Data Update Frequency:** Quotes and Market Cap — real-time; financial statements — as published (API requests to EDGAR or data providers).
* **Performance:** Dashboard response time when switching between tickers — no more than 1.5 seconds.
* **Adaptability:** Correct display on monitors (from 1920x1080) and tablets.

---

## 5. Future Expansion Projects
* **Comparison Module:** Ability to overlay charts of two or more companies (e.g., NVDA vs. AMD) for comparative analysis.
* **Notifications:** Alert system when a specific P/E level is reached, and display of news marked "Urgent."
