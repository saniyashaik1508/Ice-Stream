# IceStream — Real-Time Lakehouse Observability

> **Full Stack Project — Member 1 (Data/Streaming Foundation) + Member 2 (Observability/UI)**

A self-healing, real-time data quality and observability platform for a streaming lakehouse.
IceStream ingests e-commerce checkout telemetry through Kafka, processes it through a streaming
pipeline, and visualizes every anomaly, alert, and quarantine event on a live React dashboard.

---

## 1. Full Architecture

```
Python Transaction Generator (e-commerce events with injected faults)
        │
        ▼
Apache Kafka (KRaft mode, topic: transactions.raw)
        │
        ▼
Stream Processor (PyFlink DataStream)
   ├─ Data Quality Rules Engine (null rate, schema drift, throughput, latency)
   ├─ ML Anomaly Detector (IsolationForest)
   ├─ Circuit Breaker (trip on high error rate → route to DLQ)
   │      ├─ CLOSED  → Apache Iceberg table (MinIO/S3)
   │      └─ OPEN    → transactions.dlq + pause main sink
   ▼
Apache Iceberg table — ACID upserts + time travel
        │
        ▼
FastAPI Backend (REST + WebSocket gateway)
        │
        ▼
React Observability Dashboard (Member 2)
   ├─ Pipeline Flow (React Flow canvas)
   ├─ KPI Cards (6 metrics)
   ├─ Incident Simulator
   ├─ Alert Panel + Alert Detail
   ├─ Alert History (filterable)
   ├─ Automation Status
   └─ Quarantine State Visualization
```

---

## 2. Tech Stack

| Layer             | Technology                                       |
|-------------------|--------------------------------------------------|
| Ingestion         | Apache Kafka 3.7 (KRaft, no ZooKeeper)           |
| Stream processing | PyFlink DataStream API                           |
| Table format      | Apache Iceberg (pyiceberg + REST/SQL catalog)    |
| Object storage    | MinIO (S3-compatible)                            |
| ML                | scikit-learn IsolationForest                     |
| API               | FastAPI + WebSockets (port 8000)                 |
| Frontend          | React 18, TypeScript 5.6, Vite, React Flow 11   |
| Styling           | Tailwind CSS 3 (class-based dark mode)           |
| Icons             | Lucide React                                     |
| Orchestration     | Docker Compose                                   |

---

## 3. Repository Layout

```
frontend/                             ← This repository root
├── docker-compose.yml                ← Full stack orchestration
├── producer/                         ← Member 1: synthetic transaction generator
│   ├── generate_transactions.py      ← Kafka producer with deliberate fault injection
│   ├── requirements.txt
│   └── Dockerfile
├── stream_processor/                 ← Member 1: PyFlink job (DQ, ML, circuit breaker)
├── backend/                          ← Member 1: FastAPI REST/WebSocket backend
├── infra/
│   └── bootstrap-kafka.sh            ← Kafka topic initialization
├── docs/
│   ├── ARCHITECTURE.md
│   └── WEEKPLAN.md
└── src/                              ← Member 2: React Observability Dashboard
    ├── components/
    │   ├── PipelineNode.tsx           ← React Flow custom node (HEALTHY/WARNING/CRITICAL/QUARANTINED)
    │   ├── PipelineHeader.tsx         ← Header with scenario selector + theme toggle
    │   ├── PipelineStats.tsx          ← 6 KPI cards (Week 2: + Critical Alerts + Quarantined)
    │   ├── StatusPanel.tsx            ← On-click stage detail drawer
    │   ├── Legend.tsx                 ← Status color legend (updated Week 2)
    │   ├── IncidentSimulator.tsx      ← Week 2: 5-scenario incident trigger panel
    │   ├── AlertPanel.tsx             ← Week 2: Active/acknowledged alerts list
    │   ├── AlertDetail.tsx            ← Week 2: Full alert detail modal
    │   ├── AlertHistory.tsx           ← Week 2: Filterable alert history table
    │   ├── AutomationStatus.tsx       ← Week 2: Automated response step checklist
    │   └── PipelineHealthBanner.tsx   ← Week 2: OPERATIONAL/DEGRADED/QUARANTINED banner
    ├── hooks/
    │   ├── usePipelineSimulation.ts   ← Live metric jitter + all scenarios (extended Week 2)
    │   └── useObservability.ts        ← Week 2: Alert lifecycle + quarantine + polling
    ├── services/
    │   ├── pipelineService.ts         ← GET /api/pipeline/status abstraction
    │   ├── alertService.ts            ← GET/POST /api/alerts abstraction
    │   └── observabilityService.ts    ← GET /api/observability/rules abstraction
    ├── types/
    │   ├── pipeline.ts                ← Week 1 types (unchanged)
    │   └── observability.ts           ← Week 2: AlertSeverity, AlertStatus, DataQualityAnomaly
    ├── data/
    │   ├── pipelineData.ts            ← Baseline mock data + summary calculator
    │   └── observabilityRules.ts      ← Week 2: Rule thresholds + incident presets
    ├── context/
    │   └── ThemeContext.tsx           ← Persistent dark/light theme
    └── pages/
        └── Dashboard.tsx              ← Main dashboard (Week 1 + Week 2 integrated)
```

---

## 4. Member 1 — Streaming Foundation

### Python Transaction Generator (`producer/generate_transactions.py`)

Generates synthetic e-commerce checkout events at configurable throughput (default: 200 evt/s).
Deliberately injects faults to test the downstream data quality layer:

| Fault Type | Description |
|---|---|
| `null_amount` | Sets `total_amount = null` |
| `null_sku` | Sets `sku = null` |
| `negative_qty` | Negative quantity values |
| `schema_drift` | Renames `tax_amount → tax_amt_v2`, bumps `schema_version` to 2 |
| `huge_amount` | 50–200x spike in order value |
| `bad_type` | `quantity` set to string "N/A" |

### Kafka Topics
- `transactions.raw` — main ingest stream
- `transactions.dlq` — dead letter queue (bad data + circuit breaker open)
- `transactions.alerts` — observability alert events

### Infrastructure
- MinIO (S3-compatible) for Iceberg table data
- PostgreSQL for Iceberg REST catalog
- FastAPI backend at port 8000 (REST + WebSocket)

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
```

### 5.2 Data Quality Rules (`src/data/observabilityRules.ts`)

All thresholds are centralized in configuration — NOT hardcoded in components:

| Rule | Node | Warning Threshold | Critical Threshold | Unit |
|------|------|------------------|--------------------|------|
| Tax Amount NULL Rate | PROCESS | 10% | 40% | % |
| Event Throughput | INGEST | 500 evt/s | 200 evt/s | evt/s |
| Processing Latency | PROCESS | 500ms | 1000ms | ms |
| Schema Drift | PROCESS | v1 mismatch | unexpected | version |

### 5.3 Incident Simulator

5 scenarios available via the dashboard UI:

| Scenario | Node Affected | Status | Alert Severity |
|----------|--------------|--------|---------------|
| Healthy | All | HEALTHY | None |
| High NULL Rate | PROCESS | CRITICAL → QUARANTINED | critical |
| Schema Drift | PROCESS | CRITICAL → QUARANTINED | critical |
| Low Throughput | INGEST | WARNING | warning |
| High Latency | PROCESS | WARNING | warning |

### 5.4 Alert Lifecycle

```
New Anomaly → ACTIVE
                │
                ├─ [Acknowledge] → ACKNOWLEDGED (stays visible)
                │
                └─ [Resolve] → RESOLVED (moved to history, never deleted)
```

### 5.5 Quarantine State

When a CRITICAL anomaly occurs:
1. Affected node displays **QUARANTINED** badge (fuchsia color)
2. The `PROCESS → SERVE` edge becomes dashed with **⛔ BLOCKED** label
3. Pipeline Health Banner shows **QUARANTINED**
4. Automation status: Detect ✓ → Alert ✓ → Pause ✓ → Quarantine ✓ → Re-fetch ⏳

Recovery (select **Healthy** scenario):
1. All nodes return to **HEALTHY**
2. Active alerts auto-resolve
3. Pipeline returns to **OPERATIONAL**
4. Automation returns to monitoring mode

### 5.6 Pipeline Status Display

```
OPERATIONAL  — All stages healthy, 0 alerts
DEGRADED     — Warning-level anomaly detected
QUARANTINED  — Critical anomaly, stage(s) paused
RECOVERING   — Quarantine lifted, normalizing
```

---

## 6. API Contract (Frontend → Backend)

Service layer is currently mocked in `src/services/`. Each file has commented `fetch()` lines ready to uncomment:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pipeline/status` | GET | Stage status, events/sec, latency |
| `/api/alerts` | GET | Active + acknowledged alerts |
| `/api/alerts/history` | GET | All alerts paginated |
| `/api/observability/rules` | GET | Rule thresholds config |
| `/api/alerts/{id}/acknowledge` | POST | Acknowledge alert |
| `/api/alerts/{id}/resolve` | POST | Resolve alert |
| `/api/pipeline/{nodeId}/quarantine` | POST | Quarantine a node |

**To switch from mock to real API:** uncomment the `fetch()` block in each service file.

---

## 7. How to Run the Frontend

### Prerequisites
- Node.js v18+  /  npm v9+

```bash
cd frontend
npm install
npm run dev
```

→ Dashboard at **http://localhost:5173**

### Full Stack (Docker Compose)

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| API Docs | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

---

## 8. Week 2 Completed Features

### Observability Layer (Member 2)
- [x] Observability type system (`types/observability.ts`)
- [x] Data Quality Rules config (`data/observabilityRules.ts`) — no hardcoded values
- [x] Service abstraction layer (`services/`) — mock with real API contract documented
- [x] `useObservability` hook — alert lifecycle, quarantine, automation, 5s polling
- [x] Pipeline Health Banner — OPERATIONAL / DEGRADED / QUARANTINED / RECOVERING
- [x] Incident Simulator — 5 scenarios (buttons trigger full state changes)
- [x] Alert Panel — active + acknowledged alerts with Acknowledge button
- [x] Alert Detail modal — rule / node / column / expected vs actual vs threshold
- [x] Alert lifecycle — ACTIVE → ACKNOWLEDGED → RESOLVED (history preserved)
- [x] Alert History table — severity / status / node filter controls
- [x] Automation Status checklist — ✓ done / ⏳ pending steps
- [x] CRITICAL / QUARANTINED node status on React Flow nodes (fuchsia)
- [x] Quarantine edge — dashed red + ⛔ BLOCKED label on PROCESS → SERVE
- [x] 6 KPI cards — added Critical Alerts + Quarantined Nodes
- [x] Loading / error / retry states
- [x] Dark / light theme on all new components
- [x] Member 1 Kafka / producer / Docker work untouched
- [x] Week 1 React Flow dashboard fully preserved

### Preserved from Week 1 (Member 2)
- [x] React Flow lineage graph (INGEST → PROCESS → SERVE)
- [x] Custom PipelineNode with status colors and metrics
- [x] 4 original KPI Summary Cards
- [x] Interactive StatusPanel (click node for stage details)
- [x] Status Legend
- [x] Simulation Engine (Play/Pause/Refresh/Scenario)
- [x] Dark / Light Theme with localStorage persistence
- [x] Responsive Layout

---

## 9. Future Integration Requirements (Week 3+)

1. **Uncomment `fetch()` calls** in `src/services/` — replace mock returns with real HTTP
2. **WebSocket upgrade** — replace the 5s polling in `useObservability.ts` with WebSocket subscription to `ws://localhost:8000/ws/observability`
3. **Alert topic consumer** — backend should consume `transactions.alerts` Kafka topic and expose via REST/WebSocket
4. **Rule sync** — replace static `observabilityRules.ts` with `GET /api/observability/rules`
5. **DLQ Explorer** — build a table view consuming `transactions.dlq` events via the API
6. **Iceberg Time Travel** — query console for historical snapshots
