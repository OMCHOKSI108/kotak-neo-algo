import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_market_symbol_search(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}

    # 1. Search for Reliance across exchanges
    resp = await client.get("/api/market/search?query=RELIANCE", headers=headers)
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) >= 1
    # Both NSE and BSE should be supported
    exchanges = [r["exchange"] for r in results if r["symbol"] == "RELIANCE"]
    assert "NSE" in exchanges

    # 2. Search BSE explicitly
    bse_resp = await client.get("/api/market/search?query=SENSEX&exchange=BSE", headers=headers)
    assert bse_resp.status_code == 200
    bse_results = bse_resp.json()
    assert len(bse_results) >= 1
    assert bse_results[0]["symbol"] == "SENSEX"
    assert bse_results[0]["exchange"] == "BSE"

    # 3. Search Banking stocks
    bank_resp = await client.get("/api/market/search?query=SBIN", headers=headers)
    assert bank_resp.status_code == 200
    bank_results = bank_resp.json()
    assert any(r["symbol"] == "SBIN" for r in bank_results)
