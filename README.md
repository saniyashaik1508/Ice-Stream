# IceStream — Real-Time Lakehouse Observability & Data Lineage UI

> **Member 2 — Observability/UI Engineer (Week 1 Deliverable)**

A high-performance, real-time data-lineage and observability dashboard built with **React**, **React Flow**, **TypeScript**, and **Tailwind CSS**. It visually represents the end-to-end lakehouse streaming architecture from ingestion to analytical serving with live operational health metrics.

---

## 1. Project Purpose

IceStream is a real-time data-quality and observability system for modern data lakehouses. The Week 1 frontend provides an intuitive visual interface that clarifies:

* **Where data enters**: Ingest layer (`Apache Kafka`)
* **Where data is processed & validated**: Stream Processing layer (`Apache Flink` + Data Quality)
* **Where data is served**: Analytical Table layer (`Apache Iceberg`)
* **Operational Health**: Instant status indicators (`HEALTHY`, `WARNING`, `ERROR`, `OFFLINE`)
* **Real-time Throughput & Latency**: Dynamic event rates and stage traversal metrics

```text
┌─────────────────────────────────────────────────────────────┐
│ IceStream                              ● SYSTEM OPERATIONAL │
│ Real-Time Lakehouse Observability                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Events/sec       Pipeline Health      Avg Latency  Alerts  │
│    2,450              3/3 Healthy          145ms      0     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                 DATA LINEAGE ARCHITECTURE                   │
│                                                             │
│   ┌────────────┐       ┌────────────┐       ┌────────────┐ │
│   │   INGEST   │ ───→  │  PROCESS   │ ───→  │   SERVE    │ │
│   │            │       │            │       │            │ │
│   │   Kafka    │       │   Flink    │       │  Iceberg   │ │
│   │            │       │            │       │            │ │
│   │ ● HEALTHY  │       │ ● HEALTHY  │       │ ● HEALTHY  │ │
│   │ 2450 evt/s │       │ 2380 evt/s │       │ 2310 evt/s │ │
│   └────────────┘       └────────────┘       └────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ● Healthy    ● Warning    ● Error    ● Offline              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

* **Core**: React 18, TypeScript, Vite
* **Lineage & Graph Visualization**: React Flow (`reactflow`)
* **Styling**: Tailwind CSS, PostCSS, Autoprefixer
* **Icons**: Lucide React (`lucide-react`)
* **Utility**: `clsx`, `tailwind-merge`

---

## 3. Getting Started & How to Run

### Prerequisites
* **Node.js**: v18+ (tested on Node v20/v22)
* **npm**: v9+

### Installation

From the `frontend` directory:

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

The application will start locally at `http://localhost:3000` (or the next available port indicated in your terminal).

### Production Build

```bash
npm run build
```

---

## 4. Architecture & Component Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── PipelineNode.tsx       # Custom React Flow node with tech badge, status, metrics
│   │   ├── PipelineHeader.tsx     # Dashboard header with clock, system health, scenario controls
│   │   ├── PipelineStats.tsx      # KPI cards (Events/sec, Health, Latency, Active Alerts)
│   │   ├── StatusPanel.tsx        # Interactive stage details drawer on node click
│   │   └── Legend.tsx             # Self-explanatory pipeline status legend
│   │
│   ├── data/
│   │   └── pipelineData.ts        # Realistic baseline mock data & metric aggregators
│   │
│   ├── hooks/
│   │   └── usePipelineSimulation.ts # Decoupled live metric jitter & simulation scenarios
│   │
│   ├── types/
│   │   └── pipeline.ts            # TypeScript interfaces & backend API contract types
│   │
│   ├── pages/
│   │   └── Dashboard.tsx          # Main lineage view with React Flow canvas
│   │
│   ├── App.tsx                    # Root application component
│   ├── main.tsx                   # React DOM render entry
│   └── index.css                  # Tailwind styles and canvas animations
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 5. Custom Pipeline Node

Each node (`PipelineNode.tsx`) displays:

1. **Stage Title**: `INGEST`, `PROCESS`, `SERVE`
2. **Technology**: `Apache Kafka`, `Apache Flink`, `Apache Iceberg`
3. **Description**: Concise workload summary
4. **Status Indicator**: Accessible dot + text pill (`● HEALTHY`, `● WARNING`, `● ERROR`, `● OFFLINE`)
5. **Real-Time Metrics**:
   * `Events/sec` (e.g., `2,450`)
   * `Latency` (e.g., `120 ms`)
6. **Selection State**: Glowing ring highlight when clicked

---

## 6. Mock Data & Simulation Engine

Mock data is completely decoupled in [`src/data/pipelineData.ts`](src/data/pipelineData.ts) and managed via [`src/hooks/usePipelineSimulation.ts`](src/hooks/usePipelineSimulation.ts):

* **Realistic Baseline**: Ingest (Kafka 2,450 evt/s) → Process (Flink 2,380 evt/s) → Serve (Iceberg 2,310 evt/s).
* **Metric Jitter**: Applies subtle realistic fluctuations (±1.5%) every few seconds.
* **Scenario Controls**: Interactive presets in the header to simulate:
  1. *Healthy (100%)*
  2. *Ingest Kafka Lag* (Warning)
  3. *Flink Backpressure* (Warning)
  4. *Iceberg Commit Delay* (Error)
* **Play / Pause / Refresh**: Controllable simulation without spurious random failures.

---

## 7. Future Backend Integration Contract

The UI is strictly isolated from Kafka / Flink / Python backend dependencies, but is pre-configured to bind directly to a REST API endpoint like `GET /api/pipeline/status`:

```json
{
  "ingest": {
    "status": "healthy",
    "eventsPerSecond": 2450,
    "latencyMs": 120,
    "errorRatePct": 0.02
  },
  "process": {
    "status": "healthy",
    "eventsPerSecond": 2380,
    "latencyMs": 145,
    "errorRatePct": 0.01
  },
  "serve": {
    "status": "healthy",
    "eventsPerSecond": 2310,
    "latencyMs": 170,
    "errorRatePct": 0.00
  }
}
```

Replacing mock data with live endpoints simply requires switching the data provider in `usePipelineSimulation.ts` to `fetch('/api/pipeline/status')`.

---

## 8. Week 1 Completed Deliverables Checklist

* [x] **React + Vite + TypeScript** project initialized.
* [x] **Tailwind CSS** dark mode theme configured.
* [x] **React Flow** lineage graph with smoothstep directional animated edges.
* [x] **Custom `PipelineNode`** component with status colors, badges, and metrics.
* [x] **KPI Summary Cards** (Events/sec, Pipeline Health, Avg Latency, Active Alerts).
* [x] **Interactive `StatusPanel`** opening detailed metadata and architecture specs on node click.
* [x] **Status Legend** with accessible text labels and color markers.
* [x] **Modular Mock Data Layer** separated from UI components.
* [x] **Controllable Simulation Engine** with Play/Pause, manual refresh, and scenario presets.
* [x] **Responsive Layout** supporting desktop, laptop, and tablet viewports.
* [x] **Integration Contract Documented** for Week 2 backend connection.

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
