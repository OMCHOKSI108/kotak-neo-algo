# ==========================================
# Stage 1: Build dependencies
# ==========================================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies for compiling Python extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# ==========================================
# Stage 2: Runtime image
# ==========================================
FROM python:3.12-slim

WORKDIR /app

# Install runtime PostgreSQL client library and health check tool
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python packages from builder
COPY --from=builder /install /usr/local

# Configure Python runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Create non-root user and application directories
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/bash -m appuser && \
    mkdir -p /app/logs /app/data && \
    chown -R appuser:appuser /app

# Copy application files
COPY --chown=appuser:appuser docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --chown=appuser:appuser app /app/app
COPY --chown=appuser:appuser run.py /app/run.py

RUN chmod +x /app/docker-entrypoint.sh

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
