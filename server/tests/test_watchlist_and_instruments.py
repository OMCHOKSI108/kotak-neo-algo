import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_instruments_search_and_ranking(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}

    # 1. Test search with 'RELIANCE'
    resp = await client.get("/api/instruments/search?q=RELIANCE", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    # Check ranking: exact match RELIANCE should be at or near top
    assert data[0]["symbol"] == "RELIANCE"
    assert data[0]["exchangeSegment"] in ("nse_cm", "bse_cm")
    assert data[0]["token"] != ""

    # 2. Test search with segment filter 'equity'
    resp_eq = await client.get("/api/instruments/search?q=TCS&segment=equity", headers=headers)
    assert resp_eq.status_code == 200
    data_eq = resp_eq.json()
    assert any(d["symbol"] == "TCS" for d in data_eq)
    for d in data_eq:
        assert d["instrumentType"] in ("EQ", "IDX")

    # 3. Test multi-token query
    resp_multi = await client.get("/api/instruments/search?q=HDFC%20BANK", headers=headers)
    assert resp_multi.status_code == 200
    data_multi = resp_multi.json()
    assert any("HDFC" in d["symbol"] or "HDFC" in d["name"] for d in data_multi)


@pytest.mark.asyncio
async def test_watchlist_lifecycle(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}

    # 1. Fetch user watchlist (auto-seeds defaults if empty)
    resp = await client.get("/api/watchlist", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1
    default_symbols = [i["symbol"] for i in items]
    assert "NIFTY 50" in default_symbols or "RELIANCE" in default_symbols

    # 2. Add an instrument to watchlist
    add_payload = {
        "symbol": "SBIN",
        "tradingSymbol": "SBIN",
        "name": "State Bank of India",
        "exchange": "NSE",
        "exchangeSegment": "nse_cm",
        "instrumentType": "EQ",
        "token": "3045",
        "lotSize": 1
    }
    add_resp = await client.post("/api/watchlist/add", json=add_payload, headers=headers)
    assert add_resp.status_code == 200
    add_data = add_resp.json()
    assert add_data["success"] is True
    assert add_data["item"]["symbol"] == "SBIN"

    # 3. Verify SBIN is now present in user's watchlist
    resp_after = await client.get("/api/watchlist", headers=headers)
    assert resp_after.status_code == 200
    symbols_after = [i["symbol"] for i in resp_after.json()]
    assert "SBIN" in symbols_after

    # 4. Remove SBIN from watchlist
    del_resp = await client.delete("/api/watchlist/SBIN", headers=headers)
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["success"] is True

    # 5. Verify removal
    resp_final = await client.get("/api/watchlist", headers=headers)
    assert resp_final.status_code == 200
    symbols_final = [i["symbol"] for i in resp_final.json()]
    assert "SBIN" not in symbols_final
