import os
from pathlib import Path
from typing import List, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "historical"


def ensure_data_directory():
    """Ensure data/historical directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def generate_synthetic_ohlcv(
    symbol: str,
    start_price: float,
    days: int = 250,
    annual_volatility: float = 0.16,
    annual_drift: float = 0.12
) -> pd.DataFrame:
    """
    Generate realistic geometric Brownian motion daily OHLCV bars for an Indian market instrument.
    """
    np.random.seed(abs(hash(symbol)) % (2**32))
    dt = 1 / 252
    mu = annual_drift
    sigma = annual_volatility

    # Start date 1 year ago from today
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=int(days * 1.45))

    dates = []
    curr = start_date
    while len(dates) < days:
        if curr.weekday() < 5:  # Monday to Friday
            dates.append(curr)
        curr += timedelta(days=1)

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


def seed_sample_datasets():
    """Seed initial sample historical datasets if not present."""
    ensure_data_directory()

    instruments = {
        "NIFTY": {"price": 21800.0, "vol": 0.14, "drift": 0.15},
        "BANKNIFTY": {"price": 46500.0, "vol": 0.18, "drift": 0.14},
        "RELIANCE": {"price": 2600.0, "vol": 0.20, "drift": 0.16},
        "TCS": {"price": 3600.0, "vol": 0.18, "drift": 0.12},
        "HDFCBANK": {"price": 1500.0, "vol": 0.19, "drift": 0.11},
    }

    for sym, params in instruments.items():
        csv_file = DATA_DIR / f"{sym}_1d.csv"
        if not csv_file.exists():
            df = generate_synthetic_ohlcv(
                symbol=sym,
                start_price=params["price"],
                days=252,
                annual_volatility=params["vol"],
                annual_drift=params["drift"]
            )
            df.to_csv(csv_file, index=False)


def list_available_datasets() -> List[str]:
    """List available historical data symbols."""
    ensure_data_directory()
    seed_sample_datasets()
    files = list(DATA_DIR.glob("*.csv")) + list(DATA_DIR.glob("*.parquet"))
    symbols = set()
    for f in files:
        name = f.stem.split("_")[0]
        symbols.add(name.upper())
    return sorted(list(symbols))


def load_historical_data(symbol: str, timeframe: str = "1d") -> pd.DataFrame:
    """
    Load normalized OHLCV data for a given symbol and timeframe.
    Supports CSV and Parquet.
    """
    ensure_data_directory()
    seed_sample_datasets()

    sym_clean = symbol.upper().strip().replace(" ", "_")
    csv_path = DATA_DIR / f"{sym_clean}_{timeframe}.csv"
    parquet_path = DATA_DIR / f"{sym_clean}_{timeframe}.parquet"

    if parquet_path.exists():
        df = pd.read_parquet(parquet_path)
    elif csv_path.exists():
        df = pd.read_csv(csv_path)
    else:
        # Fallback generate and persist
        df = generate_synthetic_ohlcv(sym_clean, start_price=1000.0, days=252)
        df.to_csv(csv_path, index=False)

    # Standardize column names to lowercase
    df.columns = [c.lower().strip() for c in df.columns]
    # Ensure numeric columns
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop NaNs
    df = df.dropna().reset_index(drop=True)
    return df
