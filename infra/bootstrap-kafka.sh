#!/bin/sh
# Creates the Kafka topics IceStream needs. Runs once as a short-lived
# container after the broker is healthy (see docker-compose.yml).
set -e
BROKER="${KAFKA_BROKER:-kafka:9092}"

for topic in transactions.raw transactions.dlq transactions.alerts; do
  kafka-topics.sh --bootstrap-server "$BROKER" \
    --create --if-not-exists --topic "$topic" \
    --partitions 3 --replication-factor 1
done

echo "[bootstrap] topics ready: transactions.raw, transactions.dlq, transactions.alerts"
