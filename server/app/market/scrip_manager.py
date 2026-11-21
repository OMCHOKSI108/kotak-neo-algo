import os
import io
import csv
import time
import logging
import asyncio
from datetime import datetime, date, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

# Cache directory for downloaded Kotak Neo scrip master CSVs
CACHE_DIR = Path("/app/data/scrip_cache") if Path("/app/data").exists() else Path(__file__).resolve().parent.parent.parent / "data" / "scrip_cache"


class InstrumentSearchResult(BaseModel):
    symbol: str = Field(..., description="Canonical ticker symbol (e.g. RELIANCE, NIFTY26NOV25800CE)")
    trading_symbol: str = Field(..., description="Display trading symbol (e.g. RELIANCE-EQ, NIFTY 26NOV 25800 CE)")
    tradingSymbol: str = Field(..., description="CamelCase alias for frontend")
    name: str = Field(..., description="Company name or instrument description")
    exchange: str = Field("NSE", description="NSE or BSE")
    exchange_segment: str = Field("nse_cm", description="nse_cm, bse_cm, nse_fo, bse_fo")
    exchangeSegment: str = Field("nse_cm", description="CamelCase alias")
    instrument_type: str = Field("EQ", description="EQ, IDX, FUT, CE, PE")
    instrumentType: str = Field("EQ", description="CamelCase alias")
    token: str = Field(..., description="Kotak Neo instrument token")
    instrumentToken: str = Field(..., description="Token alias")
    pSymbol: str = Field(..., description="Kotak Neo pSymbol")
    lot_size: int = Field(1, description="Market lot size")
    lotSize: int = Field(1, description="CamelCase alias")
    strike_price: Optional[float] = None
    strikePrice: Optional[float] = None
    expiry: Optional[str] = None
    tick_size: float = 0.05


# High-liquidity base seed master to ensure instant 0ms search availability upon startup
BASE_SEED_INSTRUMENTS: List[Dict[str, Any]] = [
    # Indices
    {"symbol": "NIFTY 50", "trading_symbol": "NIFTY 50", "name": "Nifty 50 Benchmark Index", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "IDX", "token": "Nifty 50", "lot_size": 65},
    {"symbol": "NIFTY", "trading_symbol": "NIFTY 50", "name": "Nifty 50 Benchmark Index", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "IDX", "token": "Nifty 50", "lot_size": 65},
    {"symbol": "BANKNIFTY", "trading_symbol": "BANKNIFTY", "name": "Nifty Bank Sectoral Index", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "IDX", "token": "Nifty Bank", "lot_size": 30},
    {"symbol": "FINNIFTY", "trading_symbol": "FINNIFTY", "name": "Nifty Financial Services Index", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "IDX", "token": "Nifty Fin Service", "lot_size": 40},
    {"symbol": "MIDCPNIFTY", "trading_symbol": "MIDCPNIFTY", "name": "Nifty Midcap Select Index", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "IDX", "token": "NIFTY MID SELECT", "lot_size": 50},
    {"symbol": "SENSEX", "trading_symbol": "SENSEX", "name": "BSE S&P SENSEX Index", "exchange": "BSE", "exchange_segment": "bse_cm", "instrument_type": "IDX", "token": "SENSEX", "lot_size": 20},
    {"symbol": "BANKEX", "trading_symbol": "BANKEX", "name": "BSE S&P BANKEX Index", "exchange": "BSE", "exchange_segment": "bse_cm", "instrument_type": "IDX", "token": "BANKEX", "lot_size": 15},

    # Top Large-Cap NSE Equities
    {"symbol": "RELIANCE", "trading_symbol": "RELIANCE", "name": "Reliance Industries Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "2885", "lot_size": 1},
    {"symbol": "TCS", "trading_symbol": "TCS", "name": "Tata Consultancy Services Ltd", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "11536", "lot_size": 1},
    {"symbol": "HDFCBANK", "trading_symbol": "HDFCBANK", "name": "HDFC Bank Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "1333", "lot_size": 1},
    {"symbol": "ICICIBANK", "trading_symbol": "ICICIBANK", "name": "ICICI Bank Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "4963", "lot_size": 1},
    {"symbol": "INFY", "trading_symbol": "INFY", "name": "Infosys Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "1594", "lot_size": 1},
    {"symbol": "BHARTIARTL", "trading_symbol": "BHARTIARTL", "name": "Bharti Airtel Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "10604", "lot_size": 1},
    {"symbol": "SBIN", "trading_symbol": "SBIN", "name": "State Bank of India", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "3045", "lot_size": 1},
    {"symbol": "ITC", "trading_symbol": "ITC", "name": "ITC Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "1660", "lot_size": 1},
    {"symbol": "HINDUNILVR", "trading_symbol": "HINDUNILVR", "name": "Hindustan Unilever Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "1394", "lot_size": 1},
    {"symbol": "LT", "trading_symbol": "LT", "name": "Larsen & Toubro Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "1922", "lot_size": 1},
    {"symbol": "BAJFINANCE", "trading_symbol": "BAJFINANCE", "name": "Bajaj Finance Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "317", "lot_size": 1},
    {"symbol": "MARUTI", "trading_symbol": "MARUTI", "name": "Maruti Suzuki India Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "10999", "lot_size": 1},
    {"symbol": "HCLTECH", "trading_symbol": "HCLTECH", "name": "HCL Technologies Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "7229", "lot_size": 1},
    {"symbol": "TATAMOTORS", "trading_symbol": "TATAMOTORS", "name": "Tata Motors Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "3456", "lot_size": 1},
    {"symbol": "SUNPHARMA", "trading_symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "3351", "lot_size": 1},
    {"symbol": "KOTAKBANK", "trading_symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "1922", "lot_size": 1},
    {"symbol": "TITAN", "trading_symbol": "TITAN", "name": "Titan Company Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "3506", "lot_size": 1},
    {"symbol": "ADANIENT", "trading_symbol": "ADANIENT", "name": "Adani Enterprises Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "25", "lot_size": 1},
    {"symbol": "WIPRO", "trading_symbol": "WIPRO", "name": "Wipro Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "3787", "lot_size": 1},
    {"symbol": "AXISBANK", "trading_symbol": "AXISBANK", "name": "Axis Bank Limited", "exchange": "NSE", "exchange_segment": "nse_cm", "instrument_type": "EQ", "token": "5900", "lot_size": 1},

    # Corresponding BSE Equities
    {"symbol": "RELIANCE", "trading_symbol": "RELIANCE (BSE)", "name": "Reliance Industries Ltd (BSE)", "exchange": "BSE", "exchange_segment": "bse_cm", "instrument_type": "EQ", "token": "500325", "lot_size": 1},
    {"symbol": "TCS", "trading_symbol": "TCS (BSE)", "name": "Tata Consultancy Services Ltd (BSE)", "exchange": "BSE", "exchange_segment": "bse_cm", "instrument_type": "EQ", "token": "532540", "lot_size": 1},
    {"symbol": "HDFCBANK", "trading_symbol": "HDFCBANK (BSE)", "name": "HDFC Bank Ltd (BSE)", "exchange": "BSE", "exchange_segment": "bse_cm", "instrument_type": "EQ", "token": "500180", "lot_size": 1},
    {"symbol": "ICICIBANK", "trading_symbol": "ICICIBANK (BSE)", "name": "ICICI Bank Ltd (BSE)", "exchange": "BSE", "exchange_segment": "bse_cm", "instrument_type": "EQ", "token": "532174", "lot_size": 1},
    {"symbol": "INFY", "trading_symbol": "INFY (BSE)", "name": "Infosys Ltd (BSE)", "exchange": "BSE", "exchange_segment": "bse_cm", "instrument_type": "EQ", "token": "500209", "lot_size": 1},
]


class ScripMasterManager:
    """
    High-performance in-memory scrip master search engine.
    - Loads and indexes Kotak Neo CSVs (nse_cm, bse_cm, nse_fo, bse_fo).
    - Caches scrip masters locally and refreshes daily.
    - Provides multi-token ranking search with sub-5ms response time.
    - Synchronizes resolved symbols with Kotak Neo WebSocket / quote service.
    """

    def __init__(self):
        self._instruments: List[Dict[str, Any]] = []
        self._by_symbol: Dict[str, Dict[str, Any]] = {}
        self._by_token: Dict[str, Dict[str, Any]] = {}
        self._initialized = False
        self._is_loading = False
        self._load_seed_instruments()

    def _load_seed_instruments(self):
        """Seed initial high-liquidity symbols immediately."""
        for item in BASE_SEED_INSTRUMENTS:
            self._add_instrument_record(item)
        self._initialized = True

    def _add_instrument_record(self, record: Dict[str, Any]):
        sym = record.get("symbol", "").strip().upper()
        trd = record.get("trading_symbol") or sym
        name = record.get("name") or sym
        token = str(record.get("token") or record.get("pSymbol") or "")
        seg = record.get("exchange_segment") or record.get("pExchSeg") or "nse_cm"
        itype = record.get("instrument_type") or "EQ"

        # Searchable text blob
        search_blob = f"{sym} {trd} {name} {token} {record.get('expiry') or ''} {record.get('strike_price') or ''} {itype}".upper()

        rec = {
            "symbol": sym,
            "trading_symbol": trd,
            "tradingSymbol": trd,
            "name": name,
            "exchange": record.get("exchange", "NSE"),
            "exchange_segment": seg,
            "exchangeSegment": seg,
            "instrument_type": itype,
            "instrumentType": itype,
            "token": token,
            "instrumentToken": token,
            "pSymbol": token,
            "lot_size": int(record.get("lot_size", 1)),
            "lotSize": int(record.get("lot_size", 1)),
            "strike_price": float(record["strike_price"]) if record.get("strike_price") is not None else None,
            "strikePrice": float(record["strike_price"]) if record.get("strike_price") is not None else None,
            "expiry": record.get("expiry"),
            "search_blob": search_blob,
        }

        self._instruments.append(rec)
        if sym not in self._by_symbol:
            self._by_symbol[sym] = rec
        if trd.upper() not in self._by_symbol:
            self._by_symbol[trd.upper()] = rec
        if token:
            self._by_token[f"{seg}|{token}"] = rec

    async def initialize(self):
        """Background initialization: check cache and download today's scrip masters."""
        if self._is_loading:
            return
        self._is_loading = True
        try:
            await self._load_kotak_scrip_masters()
        except Exception as e:
            logger.warning("Scrip master background download encountered exception: %s. Using seed catalog.", e)
        finally:
            self._is_loading = False

    async def _load_kotak_scrip_masters(self):
        """Fetch and parse Kotak Neo Scrip Master CSV files."""
        today_str = date.today().isoformat()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

        # Fallback/Direct URLs for Kotak Scrip Master
        urls = {
            "nse_cm": f"https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/{today_str}/transformed-v1/nse_cm-v1.csv",
            "bse_cm": f"https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/{today_str}/transformed-v1/bse_cm-v1.csv",
            "nse_fo": f"https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/{today_str}/transformed/nse_fo.csv",
            "bse_fo": f"https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/{today_str}/transformed/bse_fo.csv",
        }

        # Try to retrieve fresh URLs from Kotak SDK if consumer key is configured
        consumer_key = settings.KOTAK_CONSUMER_KEY
        if consumer_key:
            try:
                from neo_api_client import NeoAPI
                loop = asyncio.get_running_loop()
                client = NeoAPI(consumer_key=consumer_key, environment=settings.KOTAK_ENVIRONMENT or "prod")
                report = await loop.run_in_executor(None, client.scrip_master)
                if isinstance(report, dict) and "filesPaths" in report:
                    for fpath in report["filesPaths"]:
                        f_lower = fpath.lower()
                        if "nse_cm" in f_lower:
                            urls["nse_cm"] = fpath
                        elif "bse_cm" in f_lower:
                            urls["bse_cm"] = fpath
                        elif "nse_fo" in f_lower:
                            urls["nse_fo"] = fpath
                        elif "bse_fo" in f_lower:
                            urls["bse_fo"] = fpath
            except Exception as ex:
                logger.debug("Could not query dynamic scrip_master from SDK: %s", ex)

        import httpx
        for seg, url in urls.items():
            cache_file = CACHE_DIR / f"{seg}_{today_str}.csv"
            content = None

            # Read from local cache if already downloaded today
            if cache_file.exists() and cache_file.stat().st_size > 1000:
                logger.info("Loading scrip master from local cache: %s", cache_file.name)
                content = cache_file.read_text(encoding="utf-8", errors="ignore")
            else:
                logger.info("Downloading Kotak Neo %s scrip master from %s...", seg, url)
                try:
                    async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as http_client:
                        resp = await http_client.get(url)
                        if resp.status_code == 200 and len(resp.content) > 1000:
                            content = resp.text
                            cache_file.write_text(content, encoding="utf-8")
                            logger.info("Successfully cached %s scrip master (%d bytes).", seg, len(resp.content))
                except Exception as dl_err:
                    logger.warning("Failed to download %s scrip master: %s", seg, dl_err)

            if content:
                self._parse_scrip_csv(seg, content)

        logger.info("Scrip master indexing complete. Total instruments indexed: %d", len(self._instruments))

    def _parse_scrip_csv(self, seg: str, content: str):
        """Parse raw Kotak Neo CSV and populate memory index."""
        reader = csv.DictReader(io.StringIO(content))
        count = 0
        is_fo = seg.endswith("fo")
        exch = "BSE" if "bse" in seg else "NSE"

        for row in reader:
            token = row.get("pSymbol") or row.get("pSymbolName")
            if not token:
                continue

            sym_name = (row.get("pSymbolName") or "").strip()
            trd_sym = (row.get("pTrdSymbol") or sym_name).strip()
            opt_type = (row.get("pOptionType") or "").strip().upper()
            inst_type_raw = (row.get("pInstType") or "").strip().upper()
            desc = (row.get("pDesc") or "").strip()

            # Determine instrument type
            if is_fo:
                if opt_type == "CE":
                    itype = "CE"
                elif opt_type == "PE":
                    itype = "PE"
                else:
                    itype = "FUT"
            else:
                if sym_name.upper() in ("NIFTY 50", "NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY", "BANKEX"):
                    itype = "IDX"
                else:
                    itype = "EQ"

            # Parse strike price
            strike = None
            raw_strike = row.get("dStrikePrice;") or row.get("dStrikePrice") or row.get("strikePrice")
            if raw_strike:
                try:
                    val = float(raw_strike)
                    if val > 0:
                        # Kotak stores strike in paise (multiply by 100)
                        strike = val / 100.0 if val > 10000 else val
                except ValueError:
                    pass

            # Lot size
            lot = 1
            raw_lot = row.get("lLotSize") or row.get("lotSize")
            if raw_lot:
                try:
                    lot = int(raw_lot)
                except ValueError:
                    pass

            expiry_str = None
            ref_key = row.get("pScripRefKey") or ""
            # Extract date from ref_key or trd_sym (e.g. NIFTY08DEC2628200.00PE -> 08-Dec-2026)
            if is_fo:
                expiry_str = row.get("pExpiryDate") or ""

            rec_data = {
                "symbol": trd_sym if is_fo else sym_name,
                "trading_symbol": trd_sym,
                "name": desc or (f"{sym_name} {itype} {strike or ''}".strip()),
                "exchange": exch,
                "exchange_segment": seg,
                "instrument_type": itype,
                "token": str(token),
                "lot_size": lot,
                "strike_price": strike,
                "expiry": expiry_str or None,
            }

            self._add_instrument_record(rec_data)
            count += 1

        logger.info("Indexed %d instruments from %s.", count, seg)

    def search(
        self,
        query: str,
        segment: Optional[str] = None,
        limit: int = 20
    ) -> List[InstrumentSearchResult]:
        """
        Fast case-insensitive multi-token instrument search.
        Ranked: Exact match -> Prefix match -> Equities/Indices -> Nearest F&O.
        """
        t_start = time.perf_counter()
        q_clean = query.strip().upper()
        if not q_clean:
            # Return top default equities and indices
            results = [
                r for r in self._instruments
                if r["instrument_type"] in ("IDX", "EQ") and r["exchange_segment"] == "nse_cm"
            ][:limit]
            return [InstrumentSearchResult(**r) for r in results]

        tokens = q_clean.split()
        seg_filter = (segment or "all").lower().strip()

        scored_matches = []
        has_fo_query = any(t in ("CE", "PE", "FUT", "CALL", "PUT") or t.isdigit() for t in tokens)

        for item in self._instruments:
            # Filter by segment if specified
            if seg_filter in ("equity", "equities"):
                if item["instrument_type"] not in ("EQ", "EQUITY"):
                    continue
            elif seg_filter in ("fo", "fno", "derivatives"):
                if not item["exchange_segment"].endswith("fo") and item["instrument_type"] not in ("CE", "PE", "FUT"):
                    continue
            elif seg_filter in ("indices", "index"):
                if item["instrument_type"] not in ("IDX", "INDEX"):
                    continue

            # Multi-token matching: all tokens must be present in search_blob
            blob = item["search_blob"]
            if not all(tok in blob for tok in tokens):
                continue

            # Calculate ranking score
            score = 0
            sym_upper = item["symbol"].upper()
            trd_upper = item["trading_symbol"].upper()

            # 1. Exact match gets highest priority
            if sym_upper == q_clean or trd_upper == q_clean:
                score += 100000
            # 2. Starts with query prefix
            elif sym_upper.startswith(q_clean) or trd_upper.startswith(q_clean):
                score += 50000
            elif any(part.startswith(q_clean) for part in trd_upper.split()):
                score += 40000

            # 3. Categorical boosts
            itype = item["instrument_type"]
            if itype == "IDX":
                score += 35000
            elif itype == "EQ":
                # Equities boosted unless query explicitly asks for option/future
                score += 30000 if not has_fo_query else 5000
            elif itype in ("CE", "PE", "FUT"):
                if has_fo_query:
                    score += 35000
                else:
                    score += 5000

            # 4. Exchange preference: NSE slightly higher than BSE for general queries
            if item["exchange"] == "NSE":
                score += 2000

            # 5. Strike match bonus if query contains strike price
            if item["strike_price"] is not None:
                strike_str = str(int(item["strike_price"]))
                if strike_str in tokens:
                    score += 15000

            scored_matches.append((score, item))

        # Sort descending by score
        scored_matches.sort(key=lambda x: x[0], reverse=True)
        top_records = [item for _, item in scored_matches[:limit]]
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        logger.debug("Scrip search '%s' (segment=%s) returned %d results in %.2fms", query, segment, len(top_records), elapsed_ms)

        return [InstrumentSearchResult(**r) for r in top_records]

    def get_instrument_by_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Retrieve instrument record by symbol or trading_symbol."""
        return self._by_symbol.get(symbol.strip().upper())


# Global singleton scrip manager
scrip_manager = ScripMasterManager()
