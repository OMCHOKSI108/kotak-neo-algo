import pytest
from unittest.mock import MagicMock
from app.broker.kotak_adapter import KotakNeoAdapter
from app.broker.schemas import OrderRequest
from app.core.config import settings


@pytest.mark.asyncio
async def test_kotak_neo_order_placement_exact_parameter_mapping():
    """
    Verifies that KotakNeoAdapter maps order parameters to the exact types
    and canonical values required by the official Kotak Neo SDK place_order():
    - exchange_segment: 'nse_fo' / 'nse_cm' / 'bse_fo' / 'bse_cm'
    - product: 'CNC', 'NRML', 'MIS', 'MTF'
    - order_type: 'L', 'MKT', 'SL', 'SL-M' (not 'LIMIT' or 'MARKET')
    - price: '0' for MKT/SL-M; positive string e.g. '150.25' for L/SL
    - quantity: positive integer string
    - transaction_type: 'B' or 'S' (not 'BUY' or 'SELL')
    - trigger_price: '0' for L/MKT; positive string for SL/SL-M
    - amo: 'NO'
    - tag: non-empty string
    """
    orig_trading = settings.TRADING_ENABLED
    try:
        settings.TRADING_ENABLED = True
        adapter = KotakNeoAdapter()
        mock_client = MagicMock()
        mock_client.place_order.return_value = {
            "stat": "Ok",
            "nOrdNo": "241026000001",
            "stCode": 200
        }
        adapter._client = mock_client
        adapter._connected = True

        # Test 1: Options Limit Buy order
        order_req = OrderRequest(
            symbol="NIFTY26JUN22250CE",
            exchange="NSE",
            transaction_type="BUY",
            order_type="LIMIT",
            product="MIS",
            quantity=65,
            price=166.75,
            stop_loss=140.0,
            target=210.0
        )

        res = await adapter.place_order(order_req)
        assert res.success is True
        assert res.order_id == "241026000001"

        mock_client.place_order.assert_called_once_with(
            exchange_segment="nse_fo",
            product="MIS",
            price="166.75",
            order_type="L",
            quantity="65",
            validity="DAY",
            trading_symbol="NIFTY26JUN22250CE",
            transaction_type="B",
            amo="NO",
            disclosed_quantity="0",
            trigger_price="0",
            tag="NEO_ALGO"
        )

        # Test 2: Equity Market Sell order
        mock_client.place_order.reset_mock()
        mock_client.place_order.return_value = {
            "stat": "Ok",
            "nOrdNo": "241026000002",
            "stCode": 200
        }

        order_req2 = OrderRequest(
            symbol="RELIANCE",
            exchange="NSE",
            transaction_type="SELL",
            order_type="MARKET",
            product="CNC",
            quantity=10,
            price=0.0
        )

        res2 = await adapter.place_order(order_req2)
        assert res2.success is True
        assert res2.order_id == "241026000002"

        mock_client.place_order.assert_called_once_with(
            exchange_segment="nse_cm",
            product="CNC",
            price="0",
            order_type="MKT",
            quantity="10",
            validity="DAY",
            trading_symbol="RELIANCE-EQ",
            transaction_type="S",
            amo="NO",
            disclosed_quantity="0",
            trigger_price="0",
            tag="NEO_ALGO"
        )
    finally:
        settings.TRADING_ENABLED = orig_trading


@pytest.mark.asyncio
async def test_kotak_neo_option_chain_official_schema_parsing():
    """
    Verifies that KotakNeoAdapter correctly parses the official Kotak Neo Option Chain JSON response
    with modern keys:
    'instrument', 'strikePrice', 'openInterest', 'current', 'change', 'quote.prevClose', 'quote.volume'.
    Ensures no values are lost as null.
    """
    adapter = KotakNeoAdapter()
    mock_client = MagicMock()

    # Exact payload structure documented by Kotak Neo Python SDK
    mock_response = {
        "data": {
            "common_data": {
                "mktLot": "65",
                "multiplier": "1",
                "unlSymbol": "NIFTY",
                "exSeg": "nse_fo",
                "expiryDt": "2026-06-25"
            },
            "spot": {
                "ltp": "22250.00"
            },
            "call": [
                {
                    "instrument": {
                        "neoSymbol": "nse_fo|71472",
                        "symbol": "NIFTY26JUN22250CE",
                        "optionType": "CE",
                        "strikePrice": "22250",
                        "moneyness": "ATM"
                    },
                    "quote": {
                        "ltp": "166.7500",
                        "open": "89.8000",
                        "high": "214.0000",
                        "low": "77.1000",
                        "prevClose": "99.7000",
                        "close": None,
                        "volume": 225431505,
                        "depth": {
                            "buy": [{"price": "166.70", "quantity": "1500"}],
                            "sell": [{"price": "166.80", "quantity": "2000"}]
                        }
                    },
                    "openInterest": {
                        "current": 10715645,
                        "previous": 13647630,
                        "change": -2931985,
                        "changePct": -21.48
                    }
                }
            ],
            "put": [
                {
                    "instrument": {
                        "neoSymbol": "nse_fo|71473",
                        "symbol": "NIFTY26JUN22250PE",
                        "optionType": "PE",
                        "strikePrice": "22250",
                        "moneyness": "ATM"
                    },
                    "quote": {
                        "ltp": "142.3000",
                        "open": "180.0000",
                        "high": "195.0000",
                        "low": "135.0000",
                        "prevClose": "175.5000",
                        "close": None,
                        "volume": 189400210,
                        "depth": {
                            "buy": [{"price": "142.25", "quantity": "1200"}],
                            "sell": [{"price": "142.35", "quantity": "1800"}]
                        }
                    },
                    "openInterest": {
                        "current": 8920400,
                        "previous": 7810200,
                        "change": 1110200,
                        "changePct": 14.21
                    }
                }
            ]
        }
    }

    mock_client.option_chain.return_value = mock_response
    mock_client.expiries.return_value = {"expiries": ["2026-06-25"]}
    adapter._client = mock_client
    adapter._connected = True

    chain = await adapter.get_option_chain("NIFTY", "2026-06-25")

    assert chain.underlying == "NIFTY"
    assert chain.lot_size == 65
    assert chain.underlying_ltp == 22250.00
    assert len(chain.strikes) == 1

    strike = chain.strikes[0]
    assert strike.strike_price == 22250.0

    # Validate Call fields
    c = strike.call
    assert c is not None
    assert c.symbol == "NIFTY26JUN22250CE"
    assert c.ltp == 166.75
    assert c.prev_close == 99.70
    assert c.volume == 225431505
    assert c.open_interest == 10715645.0
    assert c.change_oi == -2931985.0
    assert c.bid == 166.70
    assert c.ask == 166.80
    assert c.iv is not None and c.iv > 0

    # Validate Put fields
    p = strike.put
    assert p is not None
    assert p.symbol == "NIFTY26JUN22250PE"
    assert p.ltp == 142.30
    assert p.prev_close == 175.50
    assert p.volume == 189400210
    assert p.open_interest == 8920400.0
    assert p.change_oi == 1110200.0
    assert p.bid == 142.25
    assert p.ask == 142.35
    assert p.iv is not None and p.iv > 0


def test_kotak_neo_parse_limits_all_formats():
    """
    Test that _parse_kotak_limits correctly extracts available_margin, used_margin,
    collateral, and cash from various Kotak Neo limits response structures.
    """
    # 1. Standard official Kotak Neo SDK dictionary response
    resp_dict = {
        "Category": "CLIENT_SPECIAL",
        "EntityId": "",
        "BoardLotLimit": "5000",
        "CollateralValue": "38.19",
        "Collateral": "0",
        "RmsCollateral": "0",
        "AdhocMargin": "0",
        "NotionalCash": "0",
        "MarginUsed": "18.78",
        "Net": "194000.50",
        "RmsPayInAmt": "0",
        "RmsPayOutAmt": "0",
        "Cash": "50000.00"
    }
    avail, used, collateral, cash = KotakNeoAdapter._parse_kotak_limits(resp_dict)
    assert avail == 194000.50
    assert used == 18.78
    assert collateral == 38.19
    assert cash == 50000.00

    # 2. Wrapped in data dictionary
    resp_data_dict = {
        "data": {
            "Net": "250000.00",
            "MarginUsed": "45000.00",
            "CollateralValue": "15000.00"
        }
    }
    avail, used, collateral, cash = KotakNeoAdapter._parse_kotak_limits(resp_data_dict)
    assert avail == 250000.00
    assert used == 45000.00
    assert collateral == 15000.00

    # 3. List of segment limits with seg='ALL'
    resp_list = {
        "data": [
            {"seg": "FO", "Net": "100000.00", "MarginUsed": "20000.00"},
            {"seg": "ALL", "Net": "350000.75", "MarginUsed": "55000.00", "CollateralValue": "25000.00"}
        ]
    }
    avail, used, collateral, cash = KotakNeoAdapter._parse_kotak_limits(resp_list)
    assert avail == 350000.75
    assert used == 55000.00
    assert collateral == 25000.00

    # 4. Fallback field aliases (cash, availableMargin, totMrgnUsd)
    resp_aliases = {
        "availableMargin": "75000.00",
        "totMrgnUsd": "12500.00"
    }
    avail, used, collateral, cash = KotakNeoAdapter._parse_kotak_limits(resp_aliases)
    assert avail == 75000.00
    assert used == 12500.00


@pytest.mark.asyncio
async def test_kotak_neo_get_profile_margin():
    """
    Test that KotakNeoAdapter.get_profile returns live broker profile
    with accurately parsed available_margin and used_margin.
    """
    adapter = KotakNeoAdapter(credentials={"ucc": "KOTAK98765"})
    mock_client = MagicMock()
    mock_client.limits.return_value = {
        "Net": "450000.00",
        "MarginUsed": "28500.50",
        "CollateralValue": "10000.00",
        "Cash": "450000.00"
    }
    adapter._client = mock_client
    adapter._connected = True

    profile = await adapter.get_profile()
    assert profile.client_id == "KOTAK98765"
    assert profile.available_margin == 450000.00
    assert profile.used_margin == 28500.50
    assert profile.collateral == 10000.00
    assert profile.cash == 450000.00
    assert profile.is_live is True


@pytest.mark.asyncio
async def test_kotak_neo_buy_order_rejected_when_balance_zero():
    """
    Test that when available margin/balance is 0, Kotak Neo returns a rejection
    (either pre-trade emsg or RMS order_history rejRsn) and the adapter returns
    success=False, status='REJECTED' with the exact broker error.
    """
    adapter = KotakNeoAdapter()
    mock_client = MagicMock()
    # Scenario A: Pre-trade rejection from Kotak Neo OMS
    mock_client.place_order.return_value = {
        "stat": "Not_Ok",
        "emsg": "Order cannot be processed due to insufficient margin (Available: 0.00).",
        "stCode": 1006
    }
    adapter._client = mock_client
    adapter._connected = True

    buy_req = OrderRequest(
        symbol="NIFTY24DEC24500CE",
        exchange="NSE",
        transaction_type="BUY",
        order_type="LIMIT",
        product="MIS",
        quantity=65,
        price=150.0
    )

    res = await adapter.place_order(buy_req)
    assert res.success is False
    assert res.status == "REJECTED"
    assert "insufficient margin" in res.message.lower()

    # Verify BUY sent canonical transaction_type 'B'
    mock_client.place_order.assert_called_with(
        exchange_segment="nse_fo",
        product="MIS",
        price="150.00",
        order_type="L",
        quantity="65",
        validity="DAY",
        trading_symbol="NIFTY24DEC24500CE",
        transaction_type="B",
        amo="NO",
        disclosed_quantity="0",
        trigger_price="0",
        tag="NEO_ALGO"
    )


@pytest.mark.asyncio
async def test_kotak_neo_sell_order_rms_rejected_when_balance_zero():
    """
    Test that a SELL order placed to Kotak Neo receives an nOrdNo,
    and when Kotak Neo RMS rejects due to 0 margin, the rejection is caught
    and reported with status='REJECTED'.
    """
    adapter = KotakNeoAdapter()
    mock_client = MagicMock()
    # Scenario B: OMS issues order number, then RMS rejects
    mock_client.place_order.return_value = {
        "stat": "Ok",
        "nOrdNo": "241026009999",
        "stCode": 200
    }
    mock_client.order_history.return_value = {
        "data": [
            {
                "nOrdNo": "241026009999",
                "ordSt": "rejected",
                "rejRsn": "RMS: Rule: Check Available Margin, Available 0.00, Required 125000.00"
            }
        ]
    }
    adapter._client = mock_client
    adapter._connected = True

    sell_req = OrderRequest(
        symbol="NIFTY24DEC24500PE",
        exchange="NSE",
        transaction_type="SELL",
        order_type="MARKET",
        product="NRML",
        quantity=65,
        price=0.0
    )

    res = await adapter.place_order(sell_req)
    assert res.success is False
    assert res.status == "REJECTED"
    assert "Available Margin" in res.message or "0.00" in res.message
    assert res.order_id == "241026009999"

    # Verify SELL sent canonical transaction_type 'S' and price '0' for MARKET
    mock_client.place_order.assert_called_with(
        exchange_segment="nse_fo",
        product="NRML",
        price="0",
        order_type="MKT",
        quantity="65",
        validity="DAY",
        trading_symbol="NIFTY24DEC24500PE",
        transaction_type="S",
        amo="NO",
        disclosed_quantity="0",
        trigger_price="0",
        tag="NEO_ALGO"
    )


@pytest.mark.asyncio
async def test_kotak_neo_trade_executed_when_balance_available():
    """
    Test that when the account has available balance and Kotak Neo executes the trade,
    the adapter returns success=True, status='EXECUTED' and the real order_id.
    """
    adapter = KotakNeoAdapter()
    mock_client = MagicMock()
    mock_client.place_order.return_value = {
        "stat": "Ok",
        "nOrdNo": "241026008888",
        "stCode": 200
    }
    mock_client.order_history.return_value = {
        "data": [
            {
                "nOrdNo": "241026008888",
                "ordSt": "complete",
                "fldQty": 65,
                "avgPrc": "152.50"
            }
        ]
    }
    adapter._client = mock_client
    adapter._connected = True

    buy_req = OrderRequest(
        symbol="RELIANCE",
        exchange="NSE",
        transaction_type="BUY",
        order_type="LIMIT",
        product="CNC",
        quantity=10,
        price=2950.0
    )

    res = await adapter.place_order(buy_req)
    assert res.success is True
    assert res.status == "EXECUTED"
    assert res.order_id == "241026008888"

    # Verify Cash equity on nse_cm automatically got '-EQ' suffix
    mock_client.place_order.assert_called_with(
        exchange_segment="nse_cm",
        product="CNC",
        price="2950.00",
        order_type="L",
        quantity="10",
        validity="DAY",
        trading_symbol="RELIANCE-EQ",
        transaction_type="B",
        amo="NO",
        disclosed_quantity="0",
        trigger_price="0",
        tag="NEO_ALGO"
    )


