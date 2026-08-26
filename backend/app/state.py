"""
Shared in-memory application state.

IceStream's backend is a thin, stateless-ish gateway: the source of truth
for *data* is Kafka + Iceberg, but the dashboard needs fast, rolling views
(recent alerts, DLQ samples, incident timeline, live throughput) without
re-scanning Kafka from offset 0 on every page load. This module holds those
rolling views in memory, updated by the Kafka listener
(`services/kafka_listener.py`) and read by the REST routers.

Single-process only — fine for a reference deployment; swap for Redis if
you need multi-replica backends.
"""
import time
import threading
from collections import deque

_lock = threading.Lock()

MAX_ALERTS = 200
MAX_DLQ = 200
MAX_INCIDENTS = 100


class AppState:
    def __init__(self):
        self.lineage_status = {"kafka": "ok", "flink": "ok", "iceberg": "ok", "dlq": "ok"}
        self.circuit_state = "closed"
        self.error_rate = 0.0

        self.alerts = deque(maxlen=MAX_ALERTS)
        self.dlq_records = deque(maxlen=MAX_DLQ)
        self.incidents = deque(maxlen=MAX_INCIDENTS)

        self.counters = {"raw": 0, "dlq": 0, "alerts": 0, "iceberg_appended": 0}
        self._counter_window_start = time.time()
        self._window_counts = {"raw": 0, "dlq": 0, "iceberg_appended": 0}
        self.throughput = {"raw": 0, "dlq": 0, "iceberg": 0}

        self.rules = [
            {"name": "expect_column_values_to_not_be_null", "column": "transaction_id", "enabled": True},
            {"name": "expect_column_values_to_not_be_null", "column": "sku", "enabled": True},
            {"name": "expect_column_values_to_not_be_null", "column": "total_amount", "enabled": True},
            {"name": "expect_column_values_to_be_of_type(int)", "column": "quantity", "enabled": True},
            {"name": "expect_column_values_to_be_positive", "column": "quantity", "enabled": True},
            {"name": "expect_column_values_to_be_between(0.01, 5000.0)", "column": "total_amount", "enabled": True},
        ]

    def bump(self, key: str):
        with _lock:
            self.counters[key] = self.counters.get(key, 0) + 1
            self._window_counts[key] = self._window_counts.get(key, 0) + 1
            now = time.time()
            elapsed = now - self._counter_window_start
            if elapsed >= 1.0:
                self.throughput = {
                    "raw": round(self._window_counts.get("raw", 0) / elapsed, 1),
                    "dlq": round(self._window_counts.get("dlq", 0) / elapsed, 1),
                    "iceberg": round(self._window_counts.get("iceberg_appended", 0) / elapsed, 1),
                }
                self._window_counts = {"raw": 0, "dlq": 0, "iceberg_appended": 0}
                self._counter_window_start = now

    def add_alert(self, alert: dict):
        with _lock:
            self.alerts.appendleft(alert)

    def add_dlq(self, record: dict):
        with _lock:
            self.dlq_records.appendleft(record)

    def add_incident(self, incident: dict):
        with _lock:
            self.incidents.appendleft(incident)

    def set_circuit(self, state: str, error_rate: float = None):
        with _lock:
            self.circuit_state = state
            if error_rate is not None:
                self.error_rate = error_rate
            self.lineage_status["flink"] = "bad" if state == "open" else ("warn" if state == "half_open" else "ok")
            self.lineage_status["dlq"] = "warn" if state != "closed" else "ok"

    def snapshot(self):
        with _lock:
            return {
                "lineage_status": dict(self.lineage_status),
                "circuit_state": self.circuit_state,
                "error_rate": self.error_rate,
                "throughput": dict(self.throughput),
                "counters": dict(self.counters),
            }


state = AppState()
