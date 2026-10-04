from typing import Dict, Any


def calculate_slippage(price: float, side: str, slippage_pct: float = 0.0005) -> float:
    """
    Simulate slippage on order execution.
    BUY orders slip upward; SELL orders slip downward.
    """
    if side.upper() == "BUY":
        return round(price * (1.0 + slippage_pct), 2)
    else:
        return round(price * (1.0 - slippage_pct), 2)


def calculate_indian_transaction_charges(
    turnover: float,
    side: str,
    segment: str = "equity_intraday",
    custom_brokerage_per_order: float = 20.0
) -> Dict[str, float]:
    """
    Calculates realistic Indian regulatory and broker transaction costs:
    - Brokerage: flat or percentage cap (e.g. Kotak Neo Trade Free Plan: 0 or flat 20)
    - STT (Securities Transaction Tax)
    - Exchange Transaction Charges (NSE: ~0.00325%)
    - GST (18% on Brokerage + Exchange charges + SEBI charges)
    - SEBI Turnover Charges (0.0001%)
    - Stamp Duty (charged only on buy turnover)
    """
    side = side.upper()
    brokerage = min(custom_brokerage_per_order, turnover * 0.0003)

    if segment == "equity_intraday":
        stt = turnover * 0.00025 if side == "SELL" else 0.0  # STT 0.025% on sell
        exch_charges = turnover * 0.0000325
        stamp_duty = turnover * 0.00003 if side == "BUY" else 0.0
    elif segment == "futures":
        stt = turnover * 0.000125 if side == "SELL" else 0.0
        exch_charges = turnover * 0.000019
        stamp_duty = turnover * 0.00002 if side == "BUY" else 0.0
    elif segment == "options":
        # Options premium turnover
        stt = turnover * 0.000625 if side == "SELL" else 0.0
        exch_charges = turnover * 0.0005
        stamp_duty = turnover * 0.00003 if side == "BUY" else 0.0
    else:  # delivery
        stt = turnover * 0.001  # 0.1% both buy & sell
        exch_charges = turnover * 0.0000325
        stamp_duty = turnover * 0.00015 if side == "BUY" else 0.0

    sebi_charges = turnover * 0.000001  # Rs 10 per crore
    gst = (brokerage + exch_charges + sebi_charges) * 0.18
    total_charges = round(brokerage + stt + exch_charges + sebi_charges + gst + stamp_duty, 2)

    return {
        "brokerage": round(brokerage, 2),
        "stt": round(stt, 2),
        "exchange_charges": round(exch_charges, 2),
        "sebi_charges": round(sebi_charges, 2),
        "gst": round(gst, 2),
        "stamp_duty": round(stamp_duty, 2),
        "total_charges": total_charges
    }
