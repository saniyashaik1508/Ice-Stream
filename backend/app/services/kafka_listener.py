"""
Background Kafka consumer threads that keep `state.py` (and therefore the
WebSocket feed and REST endpoints) up to date. The backend is just another
consumer group — it never touches the stream processor directly, matching
the way every other component in IceStream only talks through Kafka.
"""
import asyncio
import json
import os
import threading

from kafka import KafkaConsumer

from ..state import state

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")
RAW_TOPIC = os.getenv("RAW_TOPIC", "transactions.raw")
DLQ_TOPIC = os.getenv("DLQ_TOPIC", "transactions.dlq")
ALERT_TOPIC = os.getenv("ALERT_TOPIC", "transactions.alerts")


def _consumer(topic: str, group: str) -> KafkaConsumer:
    return KafkaConsumer(
        topic,
        bootstrap_servers=KAFKA_BROKER,
        group_id=group,
        auto_offset_reset="latest",
        value_deserializer=lambda v: v,
        consumer_timeout_ms=1000,
    )


def _broadcast(loop: asyncio.AbstractEventLoop, payload: dict):
    from ..websocket_manager import manager
    asyncio.run_coroutine_threadsafe(manager.broadcast(payload), loop)


def _watch_raw(loop):
    while True:
        try:
            consumer = _consumer(RAW_TOPIC, "icestream-backend-raw")
            for msg in consumer:
                state.bump("raw")
        except Exception:
            pass  # broker not ready yet / transient — retry loop


def _watch_dlq(loop):
    while True:
        try:
            consumer = _consumer(DLQ_TOPIC, "icestream-backend-dlq")
            for msg in consumer:
                state.bump("dlq")
                try:
                    record = json.loads(msg.value)
                except Exception:
                    continue
                state.add_dlq(record)
                _broadcast(loop, {"channel": "dlq", "record": record})
        except Exception:
            pass


def _watch_alerts(loop):
    while True:
        try:
            consumer = _consumer(ALERT_TOPIC, "icestream-backend-alerts")
            for msg in consumer:
                state.bump("alerts")
                try:
                    event = json.loads(msg.value)
                except Exception:
                    continue

                if event.get("type") == "circuit_breaker":
                    state.set_circuit(event["to_state"], event.get("error_rate"))
                    state.add_incident(event)
                    _broadcast(loop, {"channel": "circuit_breaker", "event": event})
                    _broadcast(loop, {"channel": "lineage", "status": state.lineage_status})
                else:
                    if event.get("type") == "rule_violation":
                        # a Flink append happened somewhere else in the
                        # window; approximate iceberg throughput accounting
                        pass
                    state.add_alert(event)
                    _broadcast(loop, {"channel": "alert", "event": event})
        except Exception:
            pass


def start(loop: asyncio.AbstractEventLoop):
    """Spawns the three consumer threads. Called once from FastAPI startup."""
    for target in (_watch_raw, _watch_dlq, _watch_alerts):
        t = threading.Thread(target=target, args=(loop,), daemon=True)
        t.start()
