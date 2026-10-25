import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_strategies_lifecycle_and_default_9_15_ema(client: AsyncClient, user_token: str):
    headers = {"Authorization": f"Bearer {user_token}"}

    # 1. Get strategies - should auto-seed default NIFTY 9/15 EMA
    resp = await client.get("/api/strategies", headers=headers)
    assert resp.status_code == 200
    strats = resp.json()
    assert len(strats) >= 1
    default_strat = next((s for s in strats if s["name"] == "NIFTY 9/15 EMA"), None)
    assert default_strat is not None
    assert default_strat["fast_ema"] == 9
    assert default_strat["slow_ema"] == 15
    assert default_strat["mode"] in ("DISABLED", "PAPER")

    strat_id = default_strat["id"]

    # 2. Deploy strategy to PAPER mode
    deploy_resp = await client.post(f"/api/strategies/{strat_id}/deploy", json={"mode": "PAPER"}, headers=headers)
    assert deploy_resp.status_code == 200
    assert deploy_resp.json()["mode"] == "PAPER"
    assert deploy_resp.json()["status"] == "RUNNING"

    # 3. Pause strategy
    pause_resp = await client.post(f"/api/strategies/{strat_id}/pause", headers=headers)
    assert pause_resp.status_code == 200
    assert pause_resp.json()["status"] == "PAUSED"

    # 4. Stop strategy
    stop_resp = await client.post(f"/api/strategies/{strat_id}/stop", headers=headers)
    assert stop_resp.status_code == 200
    assert stop_resp.json()["status"] == "STOPPED"

    # 5. Create new custom strategy via Strategy Builder
    new_strat_payload = {
        "name": "BANKNIFTY 9/15 Scalp",
        "description": "Fast 5m scalp for BANKNIFTY",
        "instrument": "BANKNIFTY",
        "timeframe": "5m",
        "fast_ema": 9,
        "slow_ema": 15,
        "option_type": "CALL",
        "strike_selection": "ATM",
        "lots": 1,
        "stop_loss": 30.0,
        "target": 60.0,
        "max_trades_per_day": 2,
        "schedule_start": "09:20",
        "schedule_end": "15:00"
    }
    create_resp = await client.post("/api/strategies", json=new_strat_payload, headers=headers)
    assert create_resp.status_code == 200
    created = create_resp.json()
    assert created["name"] == "BANKNIFTY 9/15 Scalp"
    assert created["instrument"] == "BANKNIFTY"
    assert created["status"] == "READY"
