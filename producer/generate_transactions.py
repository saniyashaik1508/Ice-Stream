"""
IceStream — synthetic e-commerce transaction generator (Week 1).

Streams thousands of mock checkout events per second into the Kafka topic
`transactions.raw`, deliberately injecting occasional bad data (null values,
schema drift, out-of-range amounts) so the downstream data-quality and
anomaly-detection layers have something real to catch.
"""
import os
import random
import time
import uuid
from datetime import datetime, timezone

import orjson
from faker import Faker
from kafka import KafkaProducer

fake = Faker()

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")
TOPIC = os.getenv("RAW_TOPIC", "transactions.raw")
TARGET_EPS = int(os.getenv("EVENTS_PER_SECOND", "200"))
BAD_DATA_RATE = float(os.getenv("BAD_DATA_RATE", "0.03"))  # ~3% of records

CATEGORIES = ["electronics", "apparel", "grocery", "home", "toys", "beauty", "sports"]
PAYMENT_METHODS = ["card", "wallet", "upi", "cod", "bnpl"]


def make_good_record() -> dict:
    qty = random.randint(1, 6)
    unit_price = round(random.uniform(3, 450), 2)
    return {
        "transaction_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": fake.uuid4(),
        "sku": f"SKU-{random.randint(10000, 99999)}",
        "category": random.choice(CATEGORIES),
        "quantity": qty,
        "unit_price": unit_price,
        "tax_amount": round(unit_price * qty * 0.08, 2),
        "total_amount": round(unit_price * qty * 1.08, 2),
        "payment_method": random.choice(PAYMENT_METHODS),
        "store_region": fake.state_abbr(),
        "schema_version": 1,
    }


def inject_fault(record: dict) -> dict:
    """Randomly corrupt a record to simulate real-world pipeline failures."""
    fault_type = random.choice(
        ["null_amount", "null_sku", "negative_qty", "schema_drift", "huge_amount", "bad_type"]
    )
    if fault_type == "null_amount":
        record["total_amount"] = None
    elif fault_type == "null_sku":
        record["sku"] = None
    elif fault_type == "negative_qty":
        record["quantity"] = -random.randint(1, 5)
    elif fault_type == "schema_drift":
        # unannounced new field + renamed field, simulating an upstream change
        record["tax_amt_v2"] = record.pop("tax_amount", None)
        record["schema_version"] = 2
    elif fault_type == "huge_amount":
        # spike anomaly: 50-200x normal order size
        record["total_amount"] = round(record["total_amount"] * random.uniform(50, 200), 2)
    elif fault_type == "bad_type":
        record["quantity"] = "N/A"
    record["_injected_fault"] = fault_type
    return record


def main():
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKER,
        value_serializer=lambda v: orjson.dumps(v),
        linger_ms=10,
    )
    print(f"[producer] streaming to {KAFKA_BROKER}/{TOPIC} at ~{TARGET_EPS} events/sec")
    interval = 1.0 / TARGET_EPS
    sent = 0
    while True:
        record = make_good_record()
        if random.random() < BAD_DATA_RATE:
            record = inject_fault(record)
        producer.send(TOPIC, value=record, key=record["transaction_id"].encode())
        sent += 1
        if sent % 1000 == 0:
            print(f"[producer] sent {sent} events")
        time.sleep(interval)


if __name__ == "__main__":
    main()
    