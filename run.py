#!/usr/bin/env python3
"""
Root runner script for Indian Algo Trading & Research Platform.
Runs server/run.py directly.
"""
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SERVER_RUN = ROOT_DIR / "server" / "run.py"

if __name__ == "__main__":
    os.chdir(ROOT_DIR / "server")
    os.execv(sys.executable, [sys.executable, str(SERVER_RUN)] + sys.argv[1:])



curl -X POST http://localhost:8000/api/broker/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "broker": "KOTAK_NEO",
    "consumer_key": "114f1d38-e9d9-4d5f-99dd-2e81650d9d31",
    "mobile_number": "+919316675927",
    "ucc": "W6BCV",
    "mpin": "181130",
    "totp_secret": "621866",
    "environment": "prod"
  }'