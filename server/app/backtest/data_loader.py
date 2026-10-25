import os
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import httpx

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "historical"

# Symbol mapping for Indian benchmark indices and stocks to public market API tickers
YAHOO_SYMBOL_MAP: Dict[str, str] = {
    "NIFTY": "^NSEI",
    "NIFTY 50": "^NSEI",
    "NIFTY50": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "NIFTY BANK": "^NSEBANK",
    "SENSEX": "^BSESN",
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "INFY": "INFY.NS",
    "SBIN": "SBIN.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "ITC": "ITC.NS",
    "TATAMOTORS": "TATAMOTORS.NS",
    "KOTAKBANK": "KOTAKBANK.NS",
    "LT": "LT.NS",
    "BAJFINANCE": "BAJFINANCE.NS",
    "MARUTI": "MARUTI.NS",
    "WIPRO": "WIPRO.NS",
}


def ensure_data_directory():
    """Ensure data/historical directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def fetch_api_historical_data(symbol: str, timeframe: str = "1d", range_period: str = "1y") -> pd.DataFrame:
    """
    Fetch real historical candle data from public market API using httpx with low latency.
    """
    sym_clean = symbol.upper().strip()
    ticker = YAHOO_SYMBOL_MAP.get(sym_clean, f"{sym_clean}.NS" if not sym_clean.startswith("^") else sym_clean)

    interval = "1d"
    if timeframe in ["1m", "5m", "15m", "60m", "1h"]:
        interval = "5m" if timeframe in ["1m", "5m"] else "15m"
        range_period = "1mo"

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&range={range_period}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                chart = data.get("chart", {})
                results = chart.get("result", [])
                if results:
                    res = results[0]
                    timestamps = res.get("timestamp", [])
                    indicators = res.get("indicators", {})
                    quote = indicators.get("quote", [{}])[0]

                    opens = quote.get("open", [])
                    highs = quote.get("high", [])
                    lows = quote.get("low", [])
                    closes = quote.get("close", [])
                    volumes = quote.get("volume", [])

                    records = []
                    for i in range(len(timestamps)):
                        c = closes[i] if i < len(closes) else None
                        if c is None or np.isnan(c):
                            continue
                        o = opens[i] if i < len(opens) and opens[i] is not None and not np.isnan(opens[i]) else c
                        h = highs[i] if i < len(highs) and highs[i] is not None and not np.isnan(highs[i]) else max(o, c)
                        l = lows[i] if i < len(lows) and lows[i] is not None and not np.isnan(lows[i]) else min(o, c)
                        v = volumes[i] if i < len(volumes) and volumes[i] is not None and not np.isnan(volumes[i]) else 0
                        dt = datetime.fromtimestamp(timestamps[i], tz=timezone.utc).strftime("%Y-%m-%d")

                        records.append({
                            "timestamp": dt,
                            "open": round(float(o), 2),
                            "high": round(float(h), 2),
                            "low": round(float(l), 2),
                            "close": round(float(c), 2),
                            "volume": int(v)
                        })

                    if records:
                        df = pd.DataFrame(records).drop_duplicates(subset=["timestamp"]).reset_index(drop=True)
                        logger.info("Successfully fetched %d real candles for %s from Market API.", len(df), symbol)
                        return df
    except Exception as e:
        logger.warning("Market API historical fetch failed for %s: %s. Falling back to local cache or generator.", symbol, e)

    return pd.DataFrame()


def generate_synthetic_ohlcv(
    symbol: str,
    start_price: float,
    days: int = 252,
    annual_volatility: float = 0.16,
    annual_drift: float = 0.12
) -> pd.DataFrame:
    """
    Deterministic backup generator used only when internet/API is completely unreachable.
    """
    np.random.seed(abs(hash(symbol)) % (2**32))
    dt = 1 / 252
    mu = annual_drift
    sigma = annual_volatility

    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - pd.Timedelta(days=int(days * 1.45))

    dates = []
    curr = start_date
    while len(dates) < days:
        if curr.weekday() < 5:
            dates.append(curr)
        curr += pd.Timedelta(days=1)

    prices = [start_price]
    for _ in range(1, days):
        shock = np.random.normal(0, 1)
        ret = (mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * shock
        next_p = prices[-1] * np.exp(ret)
        prices.append(next_p)

    records = []
    for i, date_val in enumerate(dates):
        close_p = prices[i]
        intraday_vol = sigma * np.sqrt(dt) * 0.6
        open_p = close_p * (1.0 + np.random.normal(0, intraday_vol * 0.4))
        high_p = max(open_p, close_p) * (1.0 + abs(np.random.normal(0, intraday_vol)))
        low_p = min(open_p, close_p) * (1.0 - abs(np.random.normal(0, intraday_vol)))
        volume = int(np.random.lognormal(14, 0.4))

        records.append({
            "timestamp": date_val.strftime("%Y-%m-%d"),
            "open": round(open_p, 2),
            "high": round(high_p, 2),
            "low": round(low_p, 2),
            "close": round(close_p, 2),
            "volume": volume
        })

    return pd.DataFrame(records)


def list_available_datasets() -> List[str]:
    """List available historical data symbols."""
    return [
        "NIFTY", "BANKNIFTY", "SENSEX", "RELIANCE",
        "TCS", "HDFCBANK", "ICICIBANK", "INFY", "SBIN", "TATAMOTORS"
    ]


def load_historical_data(symbol: str, timeframe: str = "1d") -> pd.DataFrame:
    """
    Load normalized OHLCV data for a given symbol and timeframe.
    Prioritizes real API market data, caches locally, and cleans NaN/outliers.
    """
    ensure_data_directory()

    sym_clean = symbol.upper().strip().replace(" ", "_")
    csv_path = DATA_DIR / f"{sym_clean}_{timeframe}.csv"

    df = pd.DataFrame()

    # 1. First attempt: Fetch fresh real candles from Live Market API
    try:
        api_df = fetch_api_historical_data(symbol, timeframe)
        if not api_df.empty and len(api_df) >= 10:
            df = api_df
            # Cache to disk for offline resilience
            df.to_csv(csv_path, index=False)
    except Exception as e:
        logger.warning("Could not fetch API historical data: %s", e)

    # 2. Second attempt: Load from disk cache if API was down
    if df.empty and csv_path.exists():
        try:
            df = pd.read_csv(csv_path)
        except Exception:
            df = pd.DataFrame()

    # 3. Last fallback: Deterministic realistic baseline so backtest never crashes
    if df.empty or len(df) < 5:
        base_prices = {
            "NIFTY": 24800.0, "BANKNIFTY": 52100.0, "SENSEX": 81200.0,
            "RELIANCE": 2720.0, "TCS": 4150.0, "HDFCBANK": 1675.0,
            "ICICIBANK": 1260.0, "INFY": 1880.0, "SBIN": 795.0
        }
        start_p = base_prices.get(sym_clean, 1000.0)
        df = generate_synthetic_ohlcv(sym_clean, start_price=start_p, days=252)
        df.to_csv(csv_path, index=False)

    # Standardize column names to lowercase
    df.columns = [c.lower().strip() for c in df.columns]
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna().reset_index(drop=True)
    return df
