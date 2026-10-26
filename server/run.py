#!/usr/bin/env python3
"""
Server runner script for Indian Algo Trading & Research Platform.
Allows starting the FastAPI backend with:
    cd server
    python run.py
"""
import os
import sys
import socket
import subprocess
import time
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


def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex((host, port)) == 0


def ensure_postgres_running():
    """Automatically start or recreate the local Docker postgres container if port 5435 is closed."""
    if not is_port_open("127.0.0.1", 5435):
        print("  [DB] PostgreSQL (port 5435) is not running. Starting 'kotak-neo-postgres' container...")
        started = False
        try:
            res = subprocess.run(["docker", "start", "kotak-neo-postgres"], capture_output=True, text=True)
            if res.returncode == 0:
                started = True
            else:
                root_dir = SERVER_DIR.parent
                compose_file = root_dir / "docker-compose.yml"
                if compose_file.exists():
                    subprocess.run(["docker", "compose", "-f", str(compose_file), "up", "-d", "postgres"], capture_output=True, check=True)
                    started = True
                else:
                    subprocess.run([
                        "docker", "run", "-d", "--name", "postgres",
                        "-v", "kotak_neo_algo_pgdata:/var/lib/postgresql/data",
                        "-p", "5435:5432",
                        "-e", "POSTGRES_USER=postgres",
                        "-e", "POSTGRES_PASSWORD=postgres",
                        "-e", "POSTGRES_DB=algo_trading",
                        "--restart", "unless-stopped",
                        "postgres:16-alpine"
                    ], capture_output=True, check=True)
                started = True
        except Exception as e:
            print(f"  [DB Warning] Could not auto-start postgres container: {e}")

        if started:
            for _ in range(20):
                if is_port_open("127.0.0.1", 5435):
                    time.sleep(1.0)
                    print("  [DB] PostgreSQL container started and ready on port 5435.")
                    break
                time.sleep(0.5)


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

    ensure_postgres_running()

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )


if __name__ == "__main__":
    main()
