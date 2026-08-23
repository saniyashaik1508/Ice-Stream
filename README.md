# IceStream — Real-Time Lakehouse Observability

A self-healing, real-time data quality and observability platform for a
streaming lakehouse. IceStream ingests e-commerce checkout telemetry through
Kafka, processes it with a Flink-style streaming job, lands it in an Apache
Iceberg table on MinIO (S3-compatible object storage), scores every record
with a Python ML anomaly detector, and automatically pauses/reroutes bad
traffic to a Dead Letter Queue via a circuit breaker — all visualized on a
live dark-mode React dashboard.

## Architecture

```
Kafka (transactions.raw)
        │
        ▼
Stream Processor (PyFlink DataStream job)
   ├─ Data Quality Rules Engine  (expectations-style validators)
   ├─ ML Anomaly Detector        (IsolationForest, scikit-learn)
   ├─ Circuit Breaker            (sliding-window error-rate trip/reset)
   │      ├─ CLOSED  → append to Iceberg table "transactions" (MinIO/S3)
   │      └─ OPEN    → route to Kafka "transactions.dlq" + pause main sink
   ▼
Apache Iceberg table (transactions) — ACID upserts + time travel
        │
        ▼
FastAPI backend  ── REST + WebSocket ──►  React dashboard (dark theme)
   - KPI cards            - Pipeline lineage (React Flow, live status)
   - Real-time charts     - Data quality rules panel
   - Incidents log        - AI anomaly alert feed
   - DLQ explorer         - Iceberg time-travel query console
```

## Stack

| Layer            | Technology                                   |
|-------------------|-----------------------------------------------|
| Ingestion         | Apache Kafka (KRaft mode, no ZooKeeper)        |
| Stream processing | Apache Flink (PyFlink DataStream API)          |
| Table format      | Apache Iceberg (pyiceberg + REST/SQL catalog)  |
| Object storage    | MinIO (S3-compatible)                          |
| ML                | scikit-learn IsolationForest                   |
| API               | FastAPI + WebSockets                           |
| Frontend          | React + Vite, Recharts, React Flow             |
| Orchestration     | Docker Compose                                 |

## Repository layout

```
icestream/
├── docker-compose.yml
├── producer/            # Week 1 — synthetic transaction generator
├── stream_processor/    # Week 2/3 — PyFlink job: rules, ML, circuit breaker
├── ml/                  # anomaly model training + inference
├── backend/             # FastAPI: REST + WebSocket gateway to the UI
├── frontend/             # React dark dashboard
├── infra/               # MinIO bucket + Kafka topic bootstrap scripts
└── docs/                # architecture notes, week-wise plan
```

## Running it

```bash
docker compose up --build
```

This brings up: Kafka, MinIO, the Postgres-backed Iceberg catalog, the
producer, the stream processor, the FastAPI backend, and the React
dashboard.

- Dashboard: http://localhost:5173
- API: http://localhost:8000/docs
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)

## Week-wise development plan

See [`docs/WEEKPLAN.md`](docs/WEEKPLAN.md) — the git commit history in this
repo follows the same weeks, so `git log --oneline` doubles as a build diary.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how a record flows
through the system, both in the happy path and when the circuit breaker
trips.

## Useful commands

```bash
make up        # docker compose up --build -d
make logs      # tail the stream processor + backend
make audit     # run the ACID concurrency audit against the live stack
make test      # run the offline rules-engine / circuit-breaker unit tests
make down      # tear everything down (including volumes)
```
