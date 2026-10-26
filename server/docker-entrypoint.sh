#!/bin/sh
set -e

# Wait for PostgreSQL to accept TCP connections before starting application
python -c "
import os, sys, time, socket
from urllib.parse import urlparse

db_url = os.environ.get('DATABASE_URL', '')
if 'postgres' in db_url:
    clean_url = db_url.replace('postgresql+asyncpg', 'http').replace('postgresql', 'http')
    parsed = urlparse(clean_url)
    host = parsed.hostname or 'postgres'
    port = parsed.port or 5432
    print(f'Verifying database TCP connectivity at {host}:{port}...')
    for _ in range(30):
        try:
            with socket.create_connection((host, port), timeout=2):
                print('Database is reachable and ready.')
                sys.exit(0)
        except (socket.error, OSError):
            time.sleep(1)
    print('Warning: Database did not respond within 30 seconds; proceeding anyway.')
"

exec "$@"
