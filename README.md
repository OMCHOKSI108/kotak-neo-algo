# Indian Algo Trading & Research Platform

A production-quality, intentionally simple Indian Algorithmic Trading & Research Platform built with **Python FastAPI**, **React (Vite + Tailwind CSS)**, and **PostgreSQL**.

The platform is designed around a **Broker-Adapter Architecture**, ensuring that trading logic, market data ingestion, option chain displays, backtesting, and the UI remain completely decoupled from any single brokerage. The system starts with an isolated, official modern **Kotak Neo Adapter** and a full-featured **Mock Broker Adapter** for safe paper development and backtesting.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |          React Client (Vite)          |
                      |   Market UI, Option Chain, Backtest   |
                      +-------------------+-------------------+
                                          |
                        REST APIs & App WebSocket (/ws/market)
                                          |
                      +-------------------v-------------------+
                      |             FastAPI Core              |
                      |   - Auth & RBAC (Admin / User)        |
                      |   - Fernet AES Credential Encryption  |
                      |   - Market Data Fan-Out Service       |
                      |   - Standalone Backtesting Engine     |
                      +-------------------+-------------------+
                                          |
                            BrokerAdapter Interface
                         (Abstract Base Contract)
                                          |
                 +------------------------+------------------------+
                 |                                                 |
+----------------v----------------+               +----------------v---------------+
|        MockBrokerAdapter        |               |         KotakNeoAdapter        |
| - Realistic Stochastic Feeds    |               | - Official kotakneoapi SDK     |
| - NIFTY / BANKNIFTY / SENSEX    |               | - SFeed native_batch WebSocket |
| - Options Greeks & CE/PE Math   |               | - TOTP + MPIN 2-Step Login     |
| - Instant Paper Execution       |               | - Safety Guardrail Enforced    |
+---------------------------------+               +--------------------------------+
                                                                   |
                                                      +------------v------------+
                                                      |   Kotak Neo Production  |
                                                      |      APIs / SFeed       |
                                                      +-------------------------+
```

### Key Architectural Principles:
1. **Frontend Isolation**: React **never** connects directly to Kotak Neo credentials, endpoints, or broker WebSockets. All communication flows through internal FastAPI REST endpoints and application WebSockets (`/ws/market`).
2. **Pluggable Broker Interface (`BrokerAdapter`)**: All broker implementations implement standard contracts:
   - `authenticate(credentials)`
   - `get_profile()`
   - `get_quotes(symbols)`
   - `get_option_chain(underlying, expiry)`
   - `subscribe_market_data(symbols, callback)`
   - `get_positions()`
   - `get_orders()`
   - `place_order(order_req)`
   - `modify_order(order_id, ...)`
   - `cancel_order(order_id)`
3. **Pluggable Brokers**: Adding Upstox, FYERS, Dhan, or Zerodha requires creating a new subclass of `BrokerAdapter` without modifying strategy, backtesting, or UI code.

---

## Safety & Security Guardrails

### 1. `TRADING_ENABLED=false` Safety Flag
- In V1, live trading is **strictly disabled** by default via `TRADING_ENABLED=false` in the root `.env`.
- `KotakNeoAdapter.place_order()`, `modify_order()`, and `cancel_order()` intercept any execution attempt and immediately return `REJECTED_SAFETY_CONTROL` if this flag is disabled.
- Paper trading and simulation run safely via `MockBrokerAdapter`.

### 2. Encryption at Rest (Fernet AES-128-CBC)
- Broker credentials (consumer keys, MPINs, mobile numbers, TOTP secrets) are encrypted before persisting into PostgreSQL using an `ENCRYPTION_KEY` located in the root `.env`.
- Even in database dumps or storage snapshots, sensitive broker keys cannot be decrypted without the environment encryption key.

### 3. Masked Secret Display (Zero Exposure)
- Secrets, tokens, MPINs, and passwords are **never displayed in full** anywhere in the React UI or API responses—even to platform administrators.
- Identifiers are masked using `mask_secret()` (e.g. `ABC************XYZ`).
- Audit logs capture administrative events while redacting sensitive fields.

### 4. Admin Role-Based Access Control (RBAC)
- **Admin**:
  - Creates user accounts with designated email, initial password, and role (`user` or `admin`).
  - Disables or deletes accounts.
  - Monitors connected broker accounts, sync status, and audit logs.
- **Trader User**:
  - Logs into the platform using credentials provisioned by the admin.
  - Connects broker accounts (Mock or Kotak Neo).
  - Views real-time market overviews, dynamic option chains, and launches backtest simulations.

---

## Modern Kotak Neo API Protocol (2026+)

### Why the Legacy Market Feed is NOT Used:
Kotak Securities officially **deprecated the legacy HS market-feed WebSocket on 15 September 2026**. The current documentation and SDK architecture require:
- **Protocol**: `SFeed` `native_batch` WebSocket protocol connecting over secure binary sockets (`wss://sfeed.kotaksecurities.com/apifeed` or dynamically returned `feedUrl`).
- **Authentication**:
  1. Consumer Key provided via API management dashboard.
  2. Step 1: `client.totp_login(mobile_number=..., ucc=..., totp=...)` generates a one-time view token.
  3. Step 2: `client.totp_validate(mpin=...)` establishes the active trading session and resolves dynamic endpoints (`baseUrl`, `sid`).
  4. Subsequent API calls use dynamic session headers.
- **SDK**: Official `kotakneoapi` (v3.0.7) installed in the backend environment.

---

## Standalone Backtesting Engine

The backtesting engine operates **completely independently of any broker API**:
- **Data Source**: Loads historical OHLCV data from local CSV/Parquet files (`server/data/historical/`). Synthetic historical datasets with realistic Brownian motion and volatility are automatically generated if data files are missing.
- **Strategy Configuration (`strategy.json`)**:
  - Strategies are parameterized via JSON rather than hardcoded in Python logic.
  - Included strategies:
    - `sma_crossover`: Fast/slow simple moving average crossover.
    - `rsi_strategy`: Relative Strength Index oversold/overbought mean reversion.
    - `breakout_strategy`: High/low channel breakout with ATR dynamic stop-loss.
- **Indian Statutory Charges & Slippage Modeling**:
  Accurately calculates real-world Indian trading transaction costs:
  - Brokerage: Configurable flat fee (e.g. ₹20/order or percentage).
  - STT / CTT: 0.1% on delivery; 0.025% on intraday sell turnover.
  - Exchange Turnover Charges: 0.00345% (NSE equity).
  - GST: 18% on (Brokerage + Exchange Charges).
  - SEBI Turnover Charges: ₹10 per crore (0.0001%).
  - Stamp Duty: 0.015% on buy turnover.
  - Slippage: Configurable percentage per fill (e.g., 0.05%).
- **Performance Metrics**:
  - Net P&L (₹) and Net Return (%)
  - Total Trades, Winning Trades, Losing Trades
  - Win Rate (%) and Profit Factor
  - Maximum Drawdown (₹ and %)
  - Annualized Sharpe Ratio and Sortino Ratio
  - Bar-by-bar Equity Curve

---

## Project Structure

```
kotak-neo-algo/
├── .env                        # Root configuration (encryption key, DB URL, safety flags)
├── .env.example                # Example environment template
├── .gitignore                  # Git ignore rules for venv, env, secrets, and DB
├── README.md                   # This documentation
├── server/                     # FastAPI Backend
│   ├── .venv/                  # Python 3.14 virtual environment (created with uv)
│   ├── requirements.txt        # Backend dependencies
│   ├── data/historical/        # CSV / Parquet historical price datasets
│   ├── tests/                  # Automated pytest suite (19 test cases)
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_broker_adapter.py
│   │   ├── test_kotak_adapter.py
│   │   ├── test_backtest.py
│   │   └── test_api_validation.py
│   └── app/
│       ├── main.py             # FastAPI entrypoint, lifespan & WebSockets
│       ├── core/               # App configuration, security & Fernet crypto
│       ├── db/                 # Async SQLAlchemy session & table migrations
│       ├── models/             # User, BrokerAccount, AuditLog, Backtest models
│       ├── broker/             # BrokerAdapter, MockBroker, KotakNeoAdapter, Factory
│       ├── market/             # Market data caching and client broadcast service
│       ├── calculations/       # Indicators, risk/charges, performance metrics
│       ├── strategies/         # Strategy interface, registry & strategy.json
│       ├── backtest/           # Data loader & bar-by-bar backtesting engine
│       └── api/                # Auth, Admin, Broker, Market, Backtest routes
└── client/                     # React Frontend
    ├── package.json            # React 18, Vite, Tailwind CSS, Lucide icons
    ├── vite.config.ts          # Proxy configuration to FastAPI backend
    ├── index.html
    └── src/
        ├── App.tsx             # Root app & tab controller
        ├── main.tsx            # Entry mount point
        ├── types.ts            # Complete TypeScript domain interfaces
        ├── api.ts              # REST client with JWT interceptor
        ├── hooks/
        │   └── useMarketData.ts# Real-time WebSocket hook with tick flash states
        ├── components/
        │   └── Navbar.tsx      # Top bar with safety badges and role switcher
        └── pages/
            ├── LoginPage.tsx          # Authentication screen
            ├── MarketDashboard.tsx    # Live tickers (NIFTY, BANKNIFTY, SENSEX) & Watchlist
            ├── OptionChainPage.tsx    # Multi-tab Option Chain (LTP, OI, Volume, PCR)
            ├── BrokerSettingsPage.tsx # Broker connection and credential management
            ├── BacktestingLab.tsx     # Strategy tuning, backtest execution & equity charts
            └── AdminDashboard.tsx     # User provisioning, status toggle & audit logs
```

---

## Installation & Setup Guide

### 1. Prerequisites
- **Python**: 3.10+ (Python 3.14 supported)
- **uv**: Fast Python package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Node.js**: 18+ and `npm`
- **PostgreSQL**: 15+ running locally (or via Docker)

---

### 2. Database Setup

Ensure PostgreSQL is running and create the `algo_trading` database:

```bash
# Using Docker (optional quick start):
docker run --name pg-algo -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=algo_trading -p 5432:5432 -d postgres:16

# Or on local PostgreSQL service:
psql -U postgres -c "CREATE DATABASE algo_trading;"
```

---

### 3. Environment Variables Configuration

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Verify or update the variables in `.env`:

```env
# Application Core
APP_NAME="Indian Algo Trading & Research Platform"
APP_ENV=development
DEBUG=true

# Safety Guardrail: Live orders disabled in V1
TRADING_ENABLED=false

# 32-byte url-safe base64 key for Fernet symmetric encryption
ENCRYPTION_KEY=W31qG6m74h2e6LpQ2z4gX7v91b_5u9Z08e4t6v7y8u8=
JWT_SECRET=production_quality_super_secret_jwt_key_2026_algo_trader

# PostgreSQL Database URL
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/algo_trading

# Default Broker Selection
DEFAULT_BROKER=mock_broker

# Kotak Neo API Credentials (Placeholders for V1)
KOTAK_CONSUMER_KEY=""
KOTAK_CONSUMER_SECRET=""
KOTAK_MOBILE_NUMBER=""
KOTAK_UCC=""
KOTAK_MPIN=""
KOTAK_TOTP_SECRET=""
KOTAK_ENVIRONMENT=prod
```

---

### 4. Backend Setup & Database Seeding

Create the virtual environment using `uv`, install dependencies, and seed the admin user:

```bash
# 1. Create virtual environment inside server/ using uv
cd server
uv venv .venv
source .venv/bin/activate

# 2. Install requirements
uv pip install -r requirements.txt

# 3. Initialize database tables and seed bootstrap Admin user
python -m app.db.init_db
```

Default Admin Credentials created during seeding:
- **Email**: `admin@kotakneoalgo.local`
- **Password**: `AdminPassword@2026!`

---

### 5. Running the Backend Server

Start the FastAPI application using `uvicorn`:

```bash
cd server
source .venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`
- Health Endpoint: `http://127.0.0.1:8000/api/health`

---

### 6. Frontend Setup & Launch

Open a separate terminal window and start the React client:

```bash
cd client
npm install
npm run dev
```

The React dashboard will be available at:
`http://localhost:5173`

---

## Running the Automated Test Suite

The backend includes 19 automated tests validating authentication, JWT tokens, Fernet credential encryption at rest, secret masking, mock adapter feeds, option chains, paper order simulation, Kotak safety guards, technical indicators, Indian statutory charges, and backtest execution.

To run the complete test suite:

```bash
cd server
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```

Expected result:
```
============================== 19 passed in 9.76s ==============================
```

---

## User & Admin Workflow

### 1. Platform Login
1. Navigate to `http://localhost:5173`.
2. Login with the seeded Administrator account (`admin@kotakneoalgo.local` / `AdminPassword@2026!`).

### 2. Admin User Management
1. Navigate to the **Admin Panel** tab.
2. Click **Add New User** to provision a trader account.
3. Toggle account active/disabled status or delete users as needed.
4. Review system audit logs for administrative events.

### 3. Market Overview & Watchlist
1. Open the **Market Overview** tab.
2. Observe live tickers for **NIFTY 50**, **BANKNIFTY**, and **SENSEX** streaming via the internal WebSocket feed.
3. Review watchlist equities (**RELIANCE**, **HDFCBANK**, **ICICIBANK**, **TCS**, **INFY**).
4. Click **View Option Chain** on any index to transition directly to its option chain.

### 4. Option Chain Analysis
1. Open the **Option Chain** tab.
2. Select between **NIFTY**, **BANKNIFTY**, and **SENSEX** tabs.
3. Select an expiry date and filter strikes (**All**, **ATM ± 5 Strikes**, **Near ATM**).
4. Inspect CE and PE strikes side-by-side with LTP, Volume, Open Interest, Bid/Ask, and Put-Call Ratio (PCR).
5. Fields unavailable from the broker are omitted—no fake data is fabricated.

### 5. Running a Backtest
1. Open the **Backtesting Lab** tab.
2. Select a Strategy (`SMA Crossover`, `RSI Reversion`, `High/Low Breakout`).
3. Choose a Dataset (`NIFTY`, `BANKNIFTY`, `RELIANCE`, `TCS`).
4. Set Capital, Slippage %, and Brokerage per order.
5. Tune strategy-specific parameters (e.g., `fast_period`, `slow_period`).
6. Click **Execute Backtest**.
7. Analyze the Equity Curve, Performance Metrics (Net P&L, Win Rate, Profit Factor, Max Drawdown), and the detailed Trade Log.

---

## How Real Kotak Neo Credentials Will Be Added Later

When you are ready to connect a live Kotak Neo account, you have two flexible methods:

### Method A: Through the Web Dashboard (Encrypted at Rest)
1. Log in to the application and navigate to the **Broker Setup** tab.
2. Under "Connect New Broker Account", select **Kotak Neo**.
3. Fill in:
   - **Consumer Key**: Your Kotak Neo API Consumer Key.
   - **Registered Mobile Number**: The 10-digit mobile number linked to Kotak Neo.
   - **Client UCC**: Your unique client code.
   - **MPIN**: Your 6-digit MPIN.
   - **TOTP Secret**: The base32 secret key from Google Authenticator / 2FA setup.
4. Click **Save & Connect Broker**.
5. The backend encrypts all credentials using Fernet AES-128 before saving to PostgreSQL.
6. The UI automatically masks all credentials (`ABC************XYZ`).

### Method B: Via Root `.env`
Update the credentials in the root `.env`:
```env
KOTAK_CONSUMER_KEY="your_actual_consumer_key"
KOTAK_MOBILE_NUMBER="+919876543210"
KOTAK_UCC="YOUR_UCC"
KOTAK_MPIN="123456"
KOTAK_TOTP_SECRET="JBSWY3DPEHPK3PXP"
KOTAK_ENVIRONMENT="prod"
```

To switch the active market data feed to Kotak Neo:
```env
DEFAULT_BROKER=kotak_neo
```

> **Note on Live Orders**: Even when connected to Kotak Neo, `TRADING_ENABLED` remains `false` until you explicitly change it to `true` in `.env`.

---

## License

MIT License. Designed and built for algorithmic trading research and disciplined quantitative execution.
