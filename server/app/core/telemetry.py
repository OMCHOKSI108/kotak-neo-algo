"""
High-Precision, Low-Overhead Telemetry & Fault Tolerance Monitor for Algo Trading.
Tracks:
- Nanosecond latency histograms across execution stages (p50, p95, p99, max)
- Event loop lag detection (detects event loop blocking)
- Rejection rates and order error tracking
- Dropped frames and slow client backpressure
"""

import time
import asyncio
import logging
from collections import deque
from typing import Dict, Any, Optional
import numpy as np

logger = logging.getLogger(__name__)


class ExecutionMetrics:
    """
    Lock-free bounded latency metric tracker.
    Stores rolling window of last N timings in nanoseconds.
    """

    def __init__(self, window_size: int = 5000):
        self.window_size = window_size
        self._latencies: Dict[str, deque] = {
            "market_data_ns": deque(maxlen=window_size),
            "strategy_eval_ns": deque(maxlen=window_size),
            "risk_check_ns": deque(maxlen=window_size),
            "order_dispatch_ns": deque(maxlen=window_size),
            "end_to_end_ns": deque(maxlen=window_size),
        }
        self.total_orders: int = 0
        self.rejected_orders: int = 0
        self.dropped_ticks: int = 0
        self.event_loop_lag_ms: float = 0.0
        self._is_monitoring: bool = False
        self._monitor_task: Optional[asyncio.Task] = None

    def record(self, stage: str, duration_ns: int):
        """Record nanosecond latency for a pipeline stage."""
        if stage in self._latencies:
            self._latencies[stage].append(duration_ns)

    def record_order(self, success: bool):
        self.total_orders += 1
        if not success:
            self.rejected_orders += 1

    def record_dropped_tick(self):
        self.dropped_ticks += 1

    def get_summary(self) -> Dict[str, Any]:
        """Calculates p50, p95, p99, max, mean in microseconds for all tracked stages."""
        summary = {
            "total_orders": self.total_orders,
            "rejected_orders": self.rejected_orders,
            "rejection_rate_pct": round((self.rejected_orders / max(1, self.total_orders)) * 100.0, 2),
            "dropped_ticks": self.dropped_ticks,
            "event_loop_lag_ms": round(self.event_loop_lag_ms, 2),
            "stages": {}
        }

        for stage, deq in self._latencies.items():
            if not deq:
                summary["stages"][stage] = {
                    "count": 0, "p50_us": 0.0, "p95_us": 0.0, "p99_us": 0.0, "max_us": 0.0
                }
                continue
            us = np.array(deq) / 1000.0
            summary["stages"][stage] = {
                "count": len(us),
                "p50_us": round(float(np.percentile(us, 50)), 2),
                "p95_us": round(float(np.percentile(us, 95)), 2),
                "p99_us": round(float(np.percentile(us, 99)), 2),
                "max_us": round(float(np.max(us)), 2),
                "mean_us": round(float(np.mean(us)), 2),
            }

        return summary

    async def start_event_loop_monitor(self, interval_s: float = 0.5):
        """Monitors asyncio event loop lag by measuring delay in timer resolution."""
        if self._is_monitoring:
            return
        self._is_monitoring = True

        async def _loop_checker():
            while self._is_monitoring:
                t0 = time.perf_counter()
                await asyncio.sleep(interval_s)
                actual_delay = time.perf_counter() - t0
                lag = max(0.0, (actual_delay - interval_s) * 1000.0)
                self.event_loop_lag_ms = lag
                if lag > 50.0:
                    logger.warning("Event loop lag spike detected: %.2f ms (possible thread blocking)", lag)

        self._monitor_task = asyncio.create_task(_loop_checker())

    def stop_event_loop_monitor(self):
        self._is_monitoring = False
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()


# Global execution telemetry singleton
execution_metrics = ExecutionMetrics()
