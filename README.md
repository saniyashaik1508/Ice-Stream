# IceStream — Real-Time Lakehouse Observability

> **Full Stack Project — Member 1 (Data/Streaming Foundation) + Member 2 (Observability/UI)**

A self-healing, real-time data quality and observability platform for a streaming lakehouse.
IceStream ingests e-commerce checkout telemetry through Kafka, processes it through a streaming
pipeline, and visualizes every anomaly, alert, and quarantine event on a live React dashboard.

---

## 1. Full Architecture

```
Python Transaction Generator  (e-commerce events with injected faults)
        │
        ▼
Apache Kafka  (KRaft mode — no ZooKeeper, topic: transactions.raw)
        │
        ▼
Stream Processor  (PyFlink DataStream)
   ├─ Data Quality Rules Engine  (null rate, schema drift, throughput, latency)
   ├─ ML Anomaly Detector        (IsolationForest)
   ├─ Circuit Breaker            (trip on high error rate → route to DLQ)
   │      ├─ CLOSED  → Apache Iceberg table (MinIO / S3)
   │      └─ OPEN    → transactions.dlq  + pause main sink
   ▼
Apache Iceberg table  —  ACID upserts + time travel
        │
        ▼
FastAPI Backend  (REST + WebSocket gateway, port 8000)
        │
        ▼
React Observability Dashboard
   ├─ Pipeline Flow Canvas  (React Flow — INGEST → PROCESS → SERVE)
   ├─ KPI Cards             (6 live metrics)
   ├─ Detection Check       (real-time bad-data flag at Flink processor)
   ├─ Incident Simulator    (5 fault scenarios)
   ├─ Alert Panel + Alert Detail
   ├─ Alert History         (filterable)
   ├─ Automation Status     (step checklist)
   └─ Quarantine Visualization
```

---

## 2. Tech Stack

| Layer             | Technology                                      |
|-------------------|-------------------------------------------------|
| Ingestion         | Apache Kafka 3.7 (KRaft, no ZooKeeper)          |
| Stream processing | PyFlink DataStream API                          |
| Table format      | Apache Iceberg (pyiceberg + REST/SQL catalog)   |
| Object storage    | MinIO (S3-compatible)                           |
| ML                | scikit-learn IsolationForest                    |
| API               | FastAPI + WebSockets (port 8000)                |
| Frontend          | React 18, TypeScript 5.6, Vite 5, React Flow 11 |
| Styling           | Tailwind CSS 3 (class-based dark/light mode)    |
| Icons             | Lucide React                                    |
| Orchestration     | Docker Compose                                  |

---

## 3. Repository Layout

```
project/                              ← Git root
├── docker-compose.yml                ← Full-stack orchestration
├── README.md
├── .gitignore                        ← Covers Python + Node patterns
│
├── frontend/                         ← React + Vite Observability UI
│   ├── Dockerfile                    ← Multi-stage build (Node → nginx)
│   ├── nginx.conf                    ← SPA routing + /api proxy to backend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── components/
│       │   ├── PipelineNode.tsx          ← React Flow custom node (HEALTHY / WARNING / CRITICAL / QUARANTINED)
│       │   ├── PipelineHeader.tsx        ← Header with scenario selector + theme toggle
│       │   ├── PipelineStats.tsx         ← 6 KPI cards
│       │   ├── FlowEdge.tsx              ← Custom React Flow edge with HTML pill labels (zoom-aware)
│       │   ├── DetectionCheck.tsx        ← Real-time bad-data detection panel
│       │   ├── StatusPanel.tsx           ← On-click stage detail drawer
│       │   ├── Legend.tsx                ← Status colour legend
│       │   ├── IncidentSimulator.tsx     ← 5-scenario incident trigger panel
│       │   ├── AlertPanel.tsx            ← Active / acknowledged alerts list
│       │   ├── AlertDetail.tsx           ← Full alert detail modal
│       │   ├── AlertHistory.tsx          ← Filterable alert history table
│       │   ├── AutomationStatus.tsx      ← Automated response step checklist
│       │   └── PipelineHealthBanner.tsx  ← OPERATIONAL / DEGRADED / QUARANTINED banner
│       ├── hooks/
│       │   ├── usePipelineSimulation.ts  ← Live metric jitter + scenario engine
│       │   └── useObservability.ts       ← Alert lifecycle, quarantine, detection events, polling
│       ├── services/
│       │   ├── pipelineService.ts        ← GET /api/pipeline/status abstraction
│       │   ├── alertService.ts           ← GET/POST /api/alerts abstraction
│       │   └── observabilityService.ts   ← GET /api/observability/rules abstraction
│       ├── types/
│       │   ├── pipeline.ts               ← Core pipeline types
│       │   └── observability.ts          ← AlertSeverity, AlertStatus, DetectionEvent, DataQualityAnomaly
│       ├── data/
│       │   ├── pipelineData.ts           ← Baseline mock data + summary calculator
│       │   └── observabilityRules.ts     ← Rule thresholds + incident presets
│       ├── context/
│       │   └── ThemeContext.tsx          ← Persistent dark/light theme
│       └── pages/
│           └── Dashboard.tsx             ← Main dashboard (all features integrated)
│
├── backend/                          ← FastAPI REST + WebSocket backend
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── state.py
│       ├── websocket_manager.py
│       ├── models/
│       ├── routers/                   ← alerts, dlq, incidents, kpi, lineage, rules, timetravel
│       └── services/                  ← iceberg_client, kafka_listener
│
├── producer/                         ← Synthetic Kafka transaction generator
│   ├── Dockerfile
│   ├── requirements.txt
│   └── generate_transactions.py      ← Fault injection: null fields, schema drift, bad types
│
├── infra/
│   └── bootstrap-kafka.sh            ← Kafka topic initialisation
│
└── docs/
    ├── ARCHITECTURE.md
    └── WEEKPLAN.md
```

---

## 4. Member 1 — Streaming Foundation

### Kafka Producer (`producer/generate_transactions.py`)

Generates synthetic e-commerce checkout events at configurable throughput (default: 200 evt/s).
Deliberately injects faults to exercise the downstream data quality layer:

| Fault Type      | Description                                                   |
|-----------------|---------------------------------------------------------------|
| `null_amount`   | Sets `total_amount = null`                                    |
| `null_sku`      | Sets `sku = null`                                             |
| `negative_qty`  | Negative quantity values                                      |
| `schema_drift`  | Renames `tax_amount → tax_amt_v2`, bumps `schema_version` to 2|
| `huge_amount`   | 50–200× spike in order value                                  |
| `bad_type`      | `quantity` set to string `"N/A"`                              |

### Kafka Topics
| Topic                  | Purpose                                              |
|------------------------|------------------------------------------------------|
| `transactions.raw`     | Main ingest stream from the producer                 |
| `transactions.dlq`     | Dead-letter queue (bad data + circuit breaker open)  |
| `transactions.alerts`  | Observability alert events from the stream processor |

### Infrastructure
- **MinIO** (S3-compatible) — Iceberg table data storage
- **PostgreSQL** — Iceberg REST catalog
- **FastAPI** — REST + WebSocket backend at port 8000

---

## 5. Member 2 — Observability Layer

### 5.1 Observability Data Model (`src/types/observability.ts`)

```typescript
type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertStatus   = 'active' | 'acknowledged' | 'resolved';

interface DataQualityAnomaly {
  id: string;
  nodeId: 'ingest' | 'process' | 'serve';
  ruleName: string;
  metric: 'null_rate' | 'throughput' | 'latency' | 'schema_drift';
  column?: string;
  expectedValue?: number | string;
  actualValue?: number | string;
  threshold?: number | string;
  severity: AlertSeverity;
  status: AlertStatus;
  detectedAt: string;
  description: string;
}

interface DetectionEvent {
  scenario: IncidentScenario;
  ruleName: string;
  detectedAtStage: 'ingest' | 'process' | 'serve';
  severity: AlertSeverity;
  column?: string;
  expectedValue: string;
  actualValue: string;
  threshold: string;
  injectedAt: string;       // HH:MM:SS
  detectedAt: string;       // HH:MM:SS
  alertRaisedAt: string;    // HH:MM:SS
  detectionLatencyMs: number;
}
```

### 5.2 Data Quality Rules (`src/data/observabilityRules.ts`)

All thresholds are centralized in configuration — not hardcoded in components:

| Rule                  | Node    | Warning Threshold | Critical Threshold | Unit    |
|-----------------------|---------|-------------------|--------------------|---------|
| Tax Amount NULL Rate  | PROCESS | 10%               | 40%                | %       |
| Event Throughput      | INGEST  | 500 evt/s         | 200 evt/s          | evt/s   |
| Processing Latency    | PROCESS | 500 ms            | 1000 ms            | ms      |
| Schema Drift          | PROCESS | v1 mismatch       | unexpected         | version |

### 5.3 Detection Check

When a fault scenario is activated, the **DetectionCheck** panel appears immediately showing:

- Severity badge + detection latency (`< Xms`)
- Metric breach: `field | expected → actual | threshold`
- Detection timeline:
  ```
  [Bad Data Injected]  →  [Flagged by Flink Processor]  →  [Alert Raised & Logged]
  ```

### 5.4 Incident Simulator

5 scenarios available via the dashboard UI:

| Scenario       | Node Affected | Status                  | Alert Severity |
|----------------|---------------|-------------------------|----------------|
| Healthy        | All           | HEALTHY                 | None           |
| High NULL Rate | PROCESS       | CRITICAL → QUARANTINED  | critical       |
| Schema Drift   | PROCESS       | CRITICAL → QUARANTINED  | critical       |
| Low Throughput | INGEST        | WARNING                 | warning        |
| High Latency   | PROCESS       | WARNING                 | warning        |

### 5.5 Alert Lifecycle

```
New Anomaly → ACTIVE
                │
                ├─ [Acknowledge] → ACKNOWLEDGED  (stays visible in panel)
                │
                └─ [Resolve]     → RESOLVED      (moved to history, never deleted)
```

### 5.6 Quarantine State

When a CRITICAL anomaly occurs:
1. Affected node displays **QUARANTINED** badge (fuchsia)
2. `PROCESS → SERVE` edge becomes dashed with **⛔ BLOCKED** label
3. Pipeline Health Banner shows **QUARANTINED**
4. Automation checklist: Detect ✓ → Alert ✓ → Pause ✓ → Quarantine ✓ → Re-fetch ⏳

Recovery (select **Healthy** scenario):
1. All nodes return to **HEALTHY**
2. Active alerts auto-resolve to history
3. Pipeline returns to **OPERATIONAL**
4. Automation returns to monitoring mode

### 5.7 Pipeline Operational States

| State          | Meaning                                      |
|----------------|----------------------------------------------|
| `OPERATIONAL`  | All stages healthy, zero active alerts       |
| `DEGRADED`     | Warning-level anomaly detected               |
| `QUARANTINED`  | Critical anomaly — one or more stages paused |
| `RECOVERING`   | Quarantine lifted, pipeline normalizing      |

---

## 6. API Contract (Frontend → Backend)

Service layer is currently mocked in `src/services/`. Each file has commented `fetch()` calls ready to activate:

| Endpoint                            | Method | Description                         |
|-------------------------------------|--------|-------------------------------------|
| `/api/pipeline/status`              | GET    | Stage status, events/sec, latency   |
| `/api/alerts`                       | GET    | Active + acknowledged alerts        |
| `/api/alerts/history`               | GET    | All alerts paginated                |
| `/api/observability/rules`          | GET    | Rule threshold configuration        |
| `/api/alerts/{id}/acknowledge`      | POST   | Acknowledge an alert                |
| `/api/alerts/{id}/resolve`          | POST   | Resolve an alert                    |
| `/api/pipeline/{nodeId}/quarantine` | POST   | Quarantine a pipeline node          |

**To switch from mock to real API:** uncomment the `fetch()` block in each service file and ensure the backend is running.

---

## 7. How to Run

### Frontend only (development)

**Prerequisites:** Node.js v18+ / npm v9+

```bash
cd project/frontend
npm install       # first time only
npm run dev
```

→ Dashboard at **http://localhost:5173**

### Full Stack (Docker Compose)

```bash
cd project
docker compose up --build
```

| Service        | URL                      |
|----------------|--------------------------|
| Dashboard      | http://localhost:5173    |
| API Docs       | http://localhost:8000/docs |
| MinIO Console  | http://localhost:9001    |

---

## 8. Completed Features

### Observability Dashboard (Member 2)
- [x] React Flow pipeline canvas — INGEST → PROCESS → SERVE with custom nodes + zoom-aware edge labels
- [x] Custom `FlowEdge` component — HTML pill labels that pan/zoom with the canvas
- [x] Detection Check panel — immediate bad-data flag with detection timeline
- [x] 6 KPI cards — Events/sec, Pipeline Health, Avg Latency, Active Alerts, Critical Alerts, Quarantined
- [x] Pipeline Health Banner — OPERATIONAL / DEGRADED / QUARANTINED / RECOVERING
- [x] Incident Simulator — 5 fault scenarios with full state propagation
- [x] Alert Panel — active + acknowledged alerts with Acknowledge action
- [x] Alert Detail modal — rule / node / column / expected vs actual vs threshold
- [x] Alert lifecycle — ACTIVE → ACKNOWLEDGED → RESOLVED (history always preserved)
- [x] Alert History table — severity / status / node filter controls
- [x] Automation Status checklist — done ✓ / pending ⏳ steps
- [x] Quarantine edge — dashed red + ⛔ BLOCKED label on PROCESS → SERVE
- [x] Dark / light theme with localStorage persistence on all components
- [x] Observability type system with `DetectionEvent` interface
- [x] Centralized data quality rules (no hardcoded thresholds in components)
- [x] Service abstraction layer with real API contract documented
- [x] MiniMap repositioned (top-right, non-overlapping)

### Streaming Foundation (Member 1)
- [x] Kafka producer with 6 fault types
- [x] PyFlink stream processor (DQ rules, ML anomaly detection, circuit breaker)
- [x] Apache Iceberg sink (ACID upserts + time travel)
- [x] FastAPI backend (REST + WebSocket)
- [x] Docker Compose orchestration (Kafka, MinIO, PostgreSQL, backend, producer)

---

## 9. Future Integration Requirements

1. **Activate real API** — uncomment `fetch()` calls in `src/services/`
2. **WebSocket upgrade** — replace 5s polling in `useObservability.ts` with `ws://localhost:8000/ws/observability`
3. **Alert topic consumer** — backend consumes `transactions.alerts` and exposes via REST/WebSocket
4. **Rule sync** — replace static `observabilityRules.ts` with `GET /api/observability/rules`
5. **DLQ Explorer** — table view consuming `transactions.dlq` events
6. **Iceberg Time Travel** — query console for historical snapshots
7. **Stream processor** — add `stream_processor/` folder and uncomment service in `docker-compose.yml`
