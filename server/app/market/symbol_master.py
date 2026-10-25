from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class SymbolSearchResult(BaseModel):
    symbol: str
    name: str
    exchange: str  # "NSE" or "BSE"
    segment: str   # "EQUITY", "INDEX", "FNO"
    lot_size: int = 1
    instrument_type: str = "EQUITY"
    token: Optional[str] = None
    tick_size: float = 0.05
    base_price: Optional[float] = None


# Comprehensive Master Catalog of Indian Market Instruments (NSE & BSE)
MASTER_SYMBOLS: List[Dict[str, Any]] = [
    # Major Indices
    {"symbol": "NIFTY 50", "name": "Nifty 50 Benchmark Index", "exchange": "NSE", "segment": "INDEX", "lot_size": 65, "instrument_type": "INDEX", "base_price": 24850.0},
    {"symbol": "BANKNIFTY", "name": "Nifty Bank Sectoral Index", "exchange": "NSE", "segment": "INDEX", "lot_size": 30, "instrument_type": "INDEX", "base_price": 52100.0},
    {"symbol": "FINNIFTY", "name": "Nifty Financial Services Index", "exchange": "NSE", "segment": "INDEX", "lot_size": 40, "instrument_type": "INDEX", "base_price": 23400.0},
    {"symbol": "MIDCPNIFTY", "name": "Nifty Midcap Select Index", "exchange": "NSE", "segment": "INDEX", "lot_size": 50, "instrument_type": "INDEX", "base_price": 12800.0},
    {"symbol": "SENSEX", "name": "BSE S&P SENSEX Index", "exchange": "BSE", "segment": "INDEX", "lot_size": 20, "instrument_type": "INDEX", "base_price": 81300.0},
    {"symbol": "BANKEX", "name": "BSE S&P BANKEX Index", "exchange": "BSE", "segment": "INDEX", "lot_size": 15, "instrument_type": "INDEX", "base_price": 58900.0},

    # Top Large-Cap & Liquid Equities - NSE
    {"symbol": "RELIANCE", "name": "Reliance Industries Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 2720.0},
    {"symbol": "TCS", "name": "Tata Consultancy Services Ltd", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 4150.0},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1675.0},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1260.0},
    {"symbol": "INFY", "name": "Infosys Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1880.0},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1690.0},
    {"symbol": "SBIN", "name": "State Bank of India", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 795.0},
    {"symbol": "ITC", "name": "ITC Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 485.0},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 2710.0},
    {"symbol": "LT", "name": "Larsen & Toubro Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 3610.0},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 7120.0},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 12450.0},
    {"symbol": "HCLTECH", "name": "HCL Technologies Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1820.0},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 930.0},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1890.0},
    {"symbol": "ONGC", "name": "Oil & Natural Gas Corporation Ltd", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 288.0},
    {"symbol": "NTPC", "name": "NTPC Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 415.0},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1780.0},
    {"symbol": "TITAN", "name": "Titan Company Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 3440.0},
    {"symbol": "ADANIENT", "name": "Adani Enterprises Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 2980.0},
    {"symbol": "ADANIPORTS", "name": "Adani Ports and SEZ Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1420.0},
    {"symbol": "POWERGRID", "name": "Power Grid Corporation of India", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 335.0},
    {"symbol": "WIPRO", "name": "Wipro Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 540.0},
    {"symbol": "ULTRACEMCO", "name": "UltraTech Cement Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 11200.0},
    {"symbol": "COALINDIA", "name": "Coal India Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 490.0},
    {"symbol": "TATASTEEL", "name": "Tata Steel Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 155.0},
    {"symbol": "JSWSTEEL", "name": "JSW Steel Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 995.0},
    {"symbol": "BAJAJFINSV", "name": "Bajaj Finserv Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1820.0},
    {"symbol": "M&M", "name": "Mahindra & Mahindra Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 3050.0},
    {"symbol": "ASIANPAINT", "name": "Asian Paints Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 2980.0},
    {"symbol": "AXISBANK", "name": "Axis Bank Limited", "exchange": "NSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1210.0},

    # Corresponding BSE Listed Stocks (BSE Code / Symbol)
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 2720.0, "token": "500325"},
    {"symbol": "TCS", "name": "Tata Consultancy Services Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 4150.0, "token": "532540"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1675.0, "token": "500180"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1260.0, "token": "532174"},
    {"symbol": "INFY", "name": "Infosys Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1880.0, "token": "500209"},
    {"symbol": "SBIN", "name": "State Bank of India (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 795.0, "token": "500112"},
    {"symbol": "ITC", "name": "ITC Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 485.0, "token": "500875"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1690.0, "token": "532454"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 930.0, "token": "500570"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 1780.0, "token": "500247"},
    {"symbol": "WIPRO", "name": "Wipro Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 540.0, "token": "507685"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki Ltd (BSE)", "exchange": "BSE", "segment": "EQUITY", "lot_size": 1, "instrument_type": "EQUITY", "base_price": 12450.0, "token": "532500"},
]


def search_symbols(query: str, exchange: Optional[str] = None, limit: int = 15) -> List[SymbolSearchResult]:
    """
    Search instruments across NSE and BSE by symbol ticker or company name.
    """
    q = query.strip().upper()
    if not q:
        # Return popular top stocks
        results = MASTER_SYMBOLS[:limit]
    else:
        results = []
        # Exact symbol match first
        for item in MASTER_SYMBOLS:
            if item["symbol"].upper() == q:
                results.append(item)

        # Prefix symbol match
        for item in MASTER_SYMBOLS:
            if item not in results and item["symbol"].upper().startswith(q):
                results.append(item)

        # Substring in symbol or name
        for item in MASTER_SYMBOLS:
            if item not in results:
                if q in item["symbol"].upper() or q in item["name"].upper():
                    results.append(item)

    # Filter by exchange if requested
    if exchange and exchange.upper() in ["NSE", "BSE"]:
        results = [r for r in results if r["exchange"].upper() == exchange.upper()]

    return [SymbolSearchResult(**r) for r in results[:limit]]
