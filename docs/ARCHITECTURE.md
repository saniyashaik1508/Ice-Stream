# Architecture Notes

## Why these components

- **Kafka** decouples the producer's write rate from every downstream
  consumer, and gives us the `transactions.dlq` / `transactions.alerts`
  topics for free as just more topics — no bespoke queueing system.
- **Flink (PyFlink DataStream API)** does the actual per-record work:
  rule validation, ML scoring, circuit-breaker accounting, and Iceberg
  writes, all in one stateful streaming job with side outputs for DLQ and
  alerts.
- **Iceberg** is the reason this is a "lakehouse" and not just a lake:
  ACID appends mean concurrent Flink writers can't corrupt the table, and
  snapshot isolation gives the time-travel console its rollback story for
  free — no separate versioning system to build.
- **MinIO** stands in for S3 so the whole stack runs locally without cloud
  credentials; swap the `S3_ENDPOINT`/keys for real AWS S3 in production.
- **The circuit breaker lives in the stream processor, not the backend**
  — it has to act on every record inline, in the same process that's
  about to write to Iceberg. The backend only *observes* its state
  changes via the alerts topic and fans them out over WebSocket.
- **The backend and stream processor never call each other directly** —
  they're independent consumers of the same Kafka topics. This means you
  can restart, redeploy, or scale either one without the other knowing.

## Data flow for one "bad" record

1. Producer injects a fault (e.g. `total_amount: None`) into a record and
   publishes it to `transactions.raw`.
2. The Flink job reads it, runs it through the rules engine —
   `expect_column_values_to_not_be_null("total_amount")` fails.
3. The circuit breaker's sliding window records one error. If the rolling
   error rate is still under threshold, only this record goes to
   `transactions.dlq`, tagged with the specific rule(s) it failed.
4. A `rule_violation` event goes to `transactions.alerts` in the same
   pass — no batch delay.
5. The backend's alert consumer thread updates `state.py` and broadcasts
   the event over `/ws/live`; the dashboard's AI Anomaly Alerts feed and
   DLQ Explorer both update within one Kafka round-trip.

## Data flow when the error rate spikes (e.g. a bad upstream deploy)

1. Enough rule violations land in a short window that the circuit
   breaker's rolling error rate crosses `ERROR_RATE_TRIP_THRESHOLD`.
2. The breaker transitions CLOSED → OPEN. `job.py` immediately starts
   rerouting *all* records — including individually valid ones — to the
   DLQ, so nothing else gets written to Iceberg while things are bad.
3. A `circuit_breaker` event goes out on `transactions.alerts`; the
   backend updates `lineage_status.flink` to `"bad"` and broadcasts it.
4. The React Flow lineage graph's Flink node turns red and the DLQ edge
   animates, live, with no page refresh.
5. After `CIRCUIT_COOLDOWN_SECONDS`, the breaker goes HALF_OPEN and
   samples a trial window; if the error rate in that trial is back under
   threshold, it closes and normal writes resume — another
   `circuit_breaker` event, another lineage update, logged in the
   Incident Log with the exact reason and timestamp.
