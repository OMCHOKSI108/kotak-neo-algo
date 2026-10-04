#!/usr/bin/env python3
"""
Server runner script for Indian Algo Trading & Research Platform.
Allows starting the FastAPI backend with:
    cd server
    python run.py
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent
VENV_DIR = SERVER_DIR / ".venv"
VENV_PYTHON = VENV_DIR / "bin" / "python"

# Ensure we are executing inside the server's dedicated virtualenv
if VENV_PYTHON.exists() and Path(sys.prefix).resolve() != VENV_DIR.resolve():
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve())] + sys.argv[1:])

# Ensure server directory is in sys.path
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

import uvicorn
from app.core.config import settings


def main():
    print("=" * 65)
    print(f"  🚀 {settings.APP_NAME}")
    print(f"  Environment : {settings.APP_ENV}")
    print(f"  API Server  : http://{settings.HOST}:{settings.PORT}")
    print(f"  API Docs    : http://127.0.0.1:{settings.PORT}/docs")
    print(f"  Health Check: http://127.0.0.1:{settings.PORT}/health")
    print(f"  Safety Mode : TRADING_ENABLED={settings.TRADING_ENABLED}")
    print("=" * 65)
    print("  To launch React frontend client in another terminal:")
    print("    cd client")
    print("    npm run dev")
    print("=" * 65)

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )


if __name__ == "__main__":
    main()
