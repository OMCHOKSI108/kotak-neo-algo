# NeoAlgo Production Indian Algorithmic Trading Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform NeoAlgo into a realistic, production-style Indian algorithmic trading terminal with broker-adapter architecture (Kotak Neo initial), real market streaming, comprehensive user and admin workflows, dedicated Trader section, 9/15 EMA algorithm engine, backtesting lab, order & position lifecycle, risk management, and analytics with zero fake/mock data.

**Architecture:** 
- **Frontend:** React + Vite + Tailwind CSS + Lucide Icons. Pure professional trading terminal design (minimal whitespace, compact data tables, clear typography, dark/light-compatible neutral surfaces). Role-segregated navigation (User vs Admin).
- **Backend:** FastAPI + SQLAlchemy 2.0 (Async) + PostgreSQL. Broker-adapter interface (`BrokerAdapter` -> `KotakNeoAdapter` -> Kotak Neo API & SFeed market feed).
- **Security:** AES-256-GCM encryption at rest for broker secrets using `BROKER_ENCRYPTION_KEY`, JWT auth, strict role-based access control, masked credentials in UI/API responses, no plain secrets logged or sent to frontend.

**Tech Stack:** FastAPI, Python 3.14, SQLAlchemy, PostgreSQL, Pydantic, Pandas, NumPy, React 18, Vite, Tailwind CSS.

---

## Global Constraints
- Architecture must remain broker-independent (`BrokerAdapter` pattern; no direct frontend-to-broker connection).
- Remove all mock users, mock accounts, fake P&L, fake orders, and demo values.
- Real backend data wherever implemented; if disconnected or empty, show proper "Not Connected / No Data" state.
- Live trading disabled by default (`TRADING_ENABLED=false` and default user mode `PAPER`).
- Live orders require explicit confirmation modal with estimated value, stop-loss, target, and audit log.
- Admin cannot see raw credentials (consumer keys, MPIN, TOTP, tokens); only masked identifiers (`XXXXXX010`).
- Store sensitive broker credentials encrypted at rest with AES-256-GCM using `BROKER_ENCRYPTION_KEY`.
- Temporary TOTP used only for immediate 2-step authentication; never store raw TOTP in database.
- Support both Flow A (Admin configures broker) and Flow B (User configures broker from own account).

---

## Tasks Breakdown

### Task 1: Database Schema Expansion (PostgreSQL Models)
**Files:**
- Modify: `server/app/models/models.py`
- Modify: `server/app/db/init_db.py`
- Test: `server/tests/test_models.py`

**Interfaces:**
- Produces: `UserTradingSettings`, `Strategy`, `OrderRecord`, `PositionRecord`, `TradeRecord` SQLAlchemy models linked to `User`.

- [ ] **Step 1: Write test for new database models**
  Create `server/tests/test_models.py` verifying model creation, defaults, and relationships.
- [ ] **Step 2: Run test to make sure it fails**
  Run `./.venv/bin/pytest tests/test_models.py`.
- [ ] **Step 3: Implement models in `server/app/models/models.py`**
  Add `UserTradingSettings`, `Strategy`, `OrderRecord`, `PositionRecord`, `TradeRecord`.
- [ ] **Step 4: Update `init_db.py`**
  Ensure default 9/15 EMA strategy and default trading settings are initialized for users if needed.
- [ ] **Step 5: Run tests to ensure pass**
  Run `./.venv/bin/pytest tests/test_models.py`.

---

### Task 2: Backend Trader & Risk Management API
**Files:**
- Create: `server/app/api/trader.py`
- Modify: `server/app/main.py`
- Test: `server/tests/test_trader_api.py`

**Interfaces:**
- Produces:
  - `GET /api/trader/settings` -> `UserTradingSettingsResponse`
  - `POST /api/trader/settings` -> updates lots (NIFTY, BANKNIFTY, SENSEX), daily loss limits, trading mode
  - `GET /api/trader/lots` -> current lot sizes (`{"NIFTY": 65, "BANKNIFTY": 30, "SENSEX": 20}`)
  - `POST /api/trader/order` -> manual order placement (Paper or Live with live confirmation validation & audit)
  - `GET /api/trader/positions` & `POST /api/trader/positions/square-off`
  - `GET /api/trader/orders`

- [ ] **Step 1: Write test for Trader & Risk API**
- [ ] **Step 2: Run test and observe failure**
- [ ] **Step 3: Implement `server/app/api/trader.py`**
- [ ] **Step 4: Register router in `server/app/main.py`**
- [ ] **Step 5: Run tests and verify 100% pass**

---

### Task 3: Backend Strategy Engine & Default 9/15 EMA Algorithm
**Files:**
- Create: `server/app/strategies/ema_9_15.py`
- Create: `server/app/api/strategies.py`
- Modify: `server/app/strategies/registry.py`
- Modify: `server/app/strategies/strategy.json`
- Modify: `server/app/main.py`
- Test: `server/tests/test_strategies_api.py`

**Interfaces:**
- Produces:
  - `Nifty915EMAStrategy` class calculating EMA 9 & 15 crossover, generating BUY CALL on bullish cross and BUY PUT on bearish cross.
  - `GET /api/strategies` -> list strategies (pre-seeding NIFTY 9/15 EMA for each user).
  - `POST /api/strategies` -> create custom strategy via builder.
  - `POST /api/strategies/{id}/deploy` -> deploy to PAPER or LIVE.
  - `POST /api/strategies/{id}/pause`, `POST /api/strategies/{id}/stop`.

- [ ] **Step 1: Write unit tests for 9/15 EMA signal generation and strategy endpoints**
- [ ] **Step 2: Implement `Nifty915EMAStrategy` in `server/app/strategies/ema_9_15.py`**
- [ ] **Step 3: Register in `registry.py` and `strategy.json`**
- [ ] **Step 4: Implement `server/app/api/strategies.py`**
- [ ] **Step 5: Register router in `server/app/main.py` and run tests**

---

### Task 4: Backend Analytics & Orders/Positions Services
**Files:**
- Create: `server/app/api/analytics.py`
- Modify: `server/app/main.py`
- Test: `server/tests/test_analytics.py`

**Interfaces:**
- Produces:
  - `GET /api/analytics` -> computed Net P&L, Win Rate, Profit Factor, Max Drawdown, Daily P&L curve, and Strategy-wise breakdown. Returns zero/empty state when no trades exist without fabrication.
  - `GET /api/broker/orders` & `GET /api/broker/positions` ensuring proper combination of live broker positions + paper positions depending on active mode.

- [ ] **Step 1: Write test for analytics calculations and empty states**
- [ ] **Step 2: Implement `server/app/api/analytics.py`**
- [ ] **Step 3: Register router in `server/app/main.py` and run tests**

---

### Task 5: Admin User Management Enhancement (Flow A + Flow B & Reset)
**Files:**
- Modify: `server/app/api/admin.py`
- Test: `server/tests/test_admin_broker_config.py`

**Interfaces:**
- Enhances:
  - `POST /api/admin/users`: Optional broker configuration block (Flow A: Admin can optionally connect Kotak Neo credentials directly on user creation, or leave unconfigured for Flow B: User connects themselves).
  - `POST /api/admin/users/{user_id}/reset-password`: Admin reset user access.
  - `DELETE /api/admin/users/{user_id}`: Admin delete user.

- [ ] **Step 1: Write test for Flow A (admin configures broker) and Flow B (empty broker, configured later)**
- [ ] **Step 2: Implement optional broker setup and user reset in `server/app/api/admin.py`**
- [ ] **Step 3: Verify all admin tests pass**

---

### Task 6: Frontend API Client & Types Update
**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`

**Interfaces:**
- Adds:
  - Types for `TradingSettings`, `StrategyItem`, `OrderRecordItem`, `PositionRecordItem`, `AnalyticsSummary`, `CreateUserPayload` (with optional broker credentials).
  - API methods: `getTradingSettings()`, `updateTradingSettings()`, `switchTradingMode()`, `getLotSizes()`, `placeOrder()`, `getPositions()`, `squareOffPosition()`, `squareOffAllPositions()`, `getOrders()`, `getStrategies()`, `createStrategy()`, `deployStrategy()`, `pauseStrategy()`, `stopStrategy()`, `deleteStrategy()`, `getAnalytics()`, `resetUserPassword()`.

- [ ] **Step 1: Update `client/src/types.ts` with all strict interfaces**
- [ ] **Step 2: Add corresponding API methods in `client/src/api.ts`**
- [ ] **Step 3: Verify frontend type check compiles cleanly**

---

### Task 7: Frontend Navigation & System Status Bar Redesign
**Files:**
- Modify: `client/src/components/Navbar.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- User tabs: Dashboard, Markets, Option Chain, Strategies, Backtest, Trader, Orders, Positions, Analytics, Brokers, Profile.
- Admin tabs: Markets, Option Chain, Backtest, Strategies, Brokers, Users, Analytics, Profile.
- Footer with real health checks (API, Feed, Broker, Algo Engine).

- [ ] **Step 1: Update `Navbar.tsx` to handle role-based navigation**
- [ ] **Step 2: Update `App.tsx` routing between tabs with clean state preservation**
- [ ] **Step 3: Integrate real `/api/health` polling for footer status indicators**

---

### Task 8: Frontend User Dashboard (`DashboardPage.tsx`) & Real Market Watchlist
**Files:**
- Create: `client/src/pages/DashboardPage.tsx`
- Modify: `client/src/pages/MarketDashboard.tsx`

**Features:**
- Market Status (Open/Closed), Feed Status (Live/Offline), Broker Status, Algo Engine Status.
- Real NIFTY 50, BANKNIFTY, SENSEX cards with LTP, Change, Day High/Low.
- Personal Trading Summary: Today's P&L, Realized/Unrealized, Open Positions, Active Strategies, Orders Today, Win Rate.
- If broker not connected: "Broker not connected. Connect Kotak Neo to view account and live trading information." No fake numbers.
- Markets page: Indices, Equities, Futures, Options tabs, search, watchlist add/remove.

- [ ] **Step 1: Implement `client/src/pages/DashboardPage.tsx`**
- [ ] **Step 2: Refine `client/src/pages/MarketDashboard.tsx` with Indices/Equities/Futures/Options tabs and search**
- [ ] **Step 3: Verify live quotes rendering**

---

### Task 9: Frontend Option Chain & Option Selection Drawer
**Files:**
- Modify: `client/src/pages/OptionChainPage.tsx`

**Features:**
- Underlying tabs: NIFTY, BANKNIFTY, SENSEX.
- Expiry selector.
- Option table: CALLS (OI, OI Chg, Vol, IV, LTP, Bid, Ask, Delta), STRIKE, PUTS. ATM highlighted.
- Option strike selection drawer/modal showing Instrument, Expiry, Strike, CE/PE, LTP, Lot Size, Quantity, Margin estimate, and quick "Trade in Trader Terminal" action.

- [ ] **Step 1: Update `OptionChainPage.tsx` with strike selection drawer**
- [ ] **Step 2: Add quick-action to transfer selected strike into Trader order ticket**

---

### Task 10: Frontend Dedicated Trader Section (`TraderPage.tsx`)
**Files:**
- Create: `client/src/pages/TraderPage.tsx`

**Features:**
- Account card (Kotak Neo, masked UCC, connection status).
- Trading Mode toggle: Paper vs Live (Live requires explicit enablement toggle).
- LOT SETTINGS:
  - NIFTY 50: [ lots ] × 65 = [ calculated quantity ]
  - BANKNIFTY: [ lots ] × 30 = [ calculated quantity ]
  - SENSEX: [ lots ] × 20 = [ calculated quantity ]
  - Saved per user in database.
- Trade Execution Ticket:
  - BUY / SELL, MARKET / LIMIT, MIS / NRML, Quantity / Lots, Price, Stop Loss, Target.
  - "CONFIRM LIVE ORDER" modal with Instrument, Side, Order, Lots, Quantity, Estimated Value, SL, Target, Cancel, PLACE LIVE ORDER.

- [ ] **Step 1: Implement `client/src/pages/TraderPage.tsx`**
- [ ] **Step 2: Connect with `api.getTradingSettings()`, `api.updateTradingSettings()`, and `api.placeOrder()`**
- [ ] **Step 3: Implement Live Order Confirmation modal**

---

### Task 11: Frontend Orders, Positions & Analytics Pages
**Files:**
- Create: `client/src/pages/OrdersPage.tsx`
- Create: `client/src/pages/PositionsPage.tsx`
- Create: `client/src/pages/AnalyticsPage.tsx`

**Features:**
- `OrdersPage.tsx`: Table with Time, Symbol, Side, Quantity, Order Type, Price, Status, Broker, Strategy, Order ID. Order details drawer. Empty state: "No orders placed today."
- `PositionsPage.tsx`: Table with Symbol, Exchange, Side, Quantity, Avg Price, LTP, P&L, Product, Strategy, Status. Total Realized/Unrealized P&L. Square Off individual & Square Off All with confirmation. Empty state: "No open positions."
- `AnalyticsPage.tsx`: Period filter (Today, 7D, 30D, All), Net P&L, Win Rate, Profit Factor, Max Drawdown, Total Trades, Equity Curve chart, Strategy-wise breakdown. Empty state if no trades.

- [ ] **Step 1: Implement `OrdersPage.tsx`**
- [ ] **Step 2: Implement `PositionsPage.tsx`**
- [ ] **Step 3: Implement `AnalyticsPage.tsx`**

---

### Task 12: Frontend Strategies Page & Strategy Builder (`StrategiesPage.tsx`)
**Files:**
- Create: `client/src/pages/StrategiesPage.tsx`

**Features:**
- Strategy cards & table: Name, Instrument, Timeframe, Status, Mode (DISABLED, PAPER, LIVE), Today's P&L, Win Rate, Trades, Max Drawdown, Last Signal, Actions (Deploy, Pause, Stop, Edit, Backtest).
- Pre-seeded default strategy: `NIFTY 9/15 EMA`.
- Strategy Builder: Entry condition (EMA 9 > EMA 15), Exit condition, Instrument, Option (CALL/PUT), Strike (ATM/ITM/OTM), Lots, Risk (SL, Target), Filters (Max trades/day), Schedule (09:20 - 15:15).
- Save Strategy to backend.

- [ ] **Step 1: Implement `StrategiesPage.tsx`**
- [ ] **Step 2: Connect with `/api/strategies` endpoints**

---

### Task 13: Enhanced Admin User Management & Modal (Flow A + Flow B)
**Files:**
- Modify: `client/src/components/CreateUserModal.tsx`
- Modify: `client/src/pages/AdminDashboard.tsx`

**Features:**
- Add User Modal:
  - Full Name, Email, Username, Temporary Password, Role, Status.
  - Checkbox: `[ ] Configure broker for this user now (Optional)`.
  - When checked: Broker: Kotak Neo, Consumer Key, Mobile Number, UCC, MPIN, TOTP (Flow A).
  - When unchecked: User can connect later from their own account (Flow B).
- User Actions: Enable/Disable, Reset Password, Delete User.
- Masked broker info, connection status, active strategies, trading status.

- [ ] **Step 1: Update `CreateUserModal.tsx` to include optional broker credentials**
- [ ] **Step 2: Update `AdminDashboard.tsx` to handle user deletion, status toggle, and password reset**

---

### Task 14: Verification, Full Build & Integration Testing
**Files:**
- All server tests
- Client build (`npm run build`)

- [ ] **Step 1: Run complete backend pytest suite**
- [ ] **Step 2: Run frontend `npm run build`**
- [ ] **Step 3: Test live login with `omchoksi99@gmail.com` and end-to-end workflows**
