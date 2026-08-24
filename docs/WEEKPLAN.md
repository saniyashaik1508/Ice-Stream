# Week-wise Development Plan

| Week | Lakehouse Engineering (Kafka, Flink, Iceberg) | Observability & Automation (Python, React) |
|---|---|---|
| **Week 1** | Stream Generation: Python producer generating thousands of mock e-commerce transactions/sec, deliberately injecting occasional null values and schema changes. | Lineage UI: Node-based React Flow dashboard visualizing the pipeline (Ingest → Process → Serve). |
| **Week 2** | Lakehouse Foundation: Apache Iceberg catalog configured on MinIO; stream processor job consumes Kafka and continuously appends records to Iceberg tables in real time. | Rules Definition: data quality assertions (`expect_column_values_to_not_be_null`, range/type checks) via a lightweight expectations-style rules engine. |
| **Mid-Project Review** | ACID Audit: proves Iceberg handles concurrent real-time writes/reads without locking or corrupting the data lake. | Detection Check: system immediately flags when injected bad data hits the stream processor. |
| **Week 3** | Automated Remediation: circuit-breaker logic — if the error rate exceeds 2%, the incoming stream routes to a Dead Letter Queue (DLQ) Kafka topic instead of the main Iceberg table. | Live Alerts: circuit-breaker status pushed to the React Flow UI over WebSockets, turning the affected pipeline node red instantly. |
| **Week 4** | Time Travel Queries: uses Iceberg snapshot isolation to query the exact state of data *before* the anomaly occurred, demonstrating easy rollback. | Refine & Polish: detailed incident log in the UI showing exactly why a pipeline was paused and when it resumed. |
| **Final Review** | An advanced deployment of the 2026 industry-standard "Lakehouse" architecture. | A self-healing data pipeline that treats data quality as a proactive engineering discipline. |

The git history of this repository is structured to match this table —
each week's commit adds exactly the files described in that row.
