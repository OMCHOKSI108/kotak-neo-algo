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
