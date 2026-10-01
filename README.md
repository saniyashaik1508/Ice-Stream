# IceStream — Real-Time Self-Healing Lakehouse Observability

> **Full Stack Project — Member 1 (Data/Streaming Foundation) + Member 2 (Observability/UI)**

A self-healing, real-time data quality and observability platform for a streaming lakehouse.
IceStream ingests e-commerce checkout telemetry through Kafka, processes it with PyFlink,
detects anomalies automatically, and visualizes every incident, alert, healing action, and
circuit-breaker event on a live React dashboard — treating data quality as a **proactive
engineering discipline**, not an afterthought.

---

## 1. Full Architecture

```
Python Transaction Generator  (e-commerce events + injected faults)
        │
        ▼
Apache Kafka  (KRaft mode — topics: raw, dlq, alerts)
        │
        ▼
Stream Processor  (PyFlink DataStream)
   ├─ Data Quality Rules Engine  (null rate, schema drift, throughput, latency)
   ├─ ML Anomaly Detector        (IsolationForest)
   ├─ Circuit Breaker            (CLOSED → HALF_OPEN → OPEN → DLQ)
   │      ├─ CLOSED  → Apache Iceberg table (MinIO / S3)
   │      └─ OPEN    → transactions.dlq  + pause main sink
   ▼
Apache Iceberg table  —  ACID upserts + time travel snapshots
        │
        ▼
FastAPI Backend  (REST + WebSocket multiplexer, port 8000)
   ├─ /api/kpi, /api/lineage, /api/alerts, /api/incidents
   ├─ /api/rules, /api/dlq, /api/iceberg (time travel)
   ├─ /api/healing  (self-healing engine endpoints)
   └─ /ws/live  (multiplexed: circuit_breaker | healing_action | snapshot)
        │
        ▼
React Observability Dashboard
   ├─ Pipeline Flow Canvas        (React Flow — INGEST → PROCESS → SERVE)
   ├─ Live Alert Banner           (real-time circuit-breaker flash)
   ├─ KPI Cards                   (6 live metrics)
   ├─ Pipeline Health Banner
   ├─ Incident Simulator          (5 fault scenarios)
   ├─ Detection Check
   ├─ Alert Panel + Alert Detail + Alert History
   ├─ Automation Status
   ├─ Incident Log                (pause/resume timeline with state transitions)
   └─ Self-Healing Panel          (health score, policies, DLQ queue, audit log)
```

---

## 2. Tech Stack

| Layer             | Technology                                        |
|-------------------|---------------------------------------------------|
| Ingestion         | Apache Kafka 3.7 (KRaft, no ZooKeeper)            |
| Stream processing | PyFlink DataStream API                            |
| Table format      | Apache Iceberg (pyiceberg + SQL catalog)          |
| Object storage    | MinIO (S3-compatible)                             |
| ML                | scikit-learn IsolationForest                      |
| API               | FastAPI + WebSockets (port 8000)                  |
| Frontend          | React 18, TypeScript 5.6, Vite 5, React Flow 11   |
| Styling           | Tailwind CSS 3 (dark / light mode)                |
| Icons             | Lucide React                                      |
| Orchestration     | Docker Compose                                    |

---

## 3. Repository Layout

```
project/
├── docker-compose.yml
├── README.md
│
├── frontend/                         ← React + Vite Observability UI
│   └── src/
│       ├── components/
│       │   ├── PipelineNode.tsx           HEALTHY / WARNING / CRITICAL / QUARANTINED node
│       │   ├── FlowEdge.tsx               Zoom-aware edge with pill labels
│       │   ├── PipelineHeader.tsx         Header — scenario selector, theme toggle, WS status
│       │   ├── PipelineStats.tsx          6 KPI cards
│       │   ├── LiveAlertBanner.tsx        Real-time circuit-breaker alert strip
│       │   ├── PipelineHealthBanner.tsx   OPERATIONAL / DEGRADED / QUARANTINED banner
│       │   ├── IncidentSimulator.tsx      5-scenario fault injector
│       │   ├── DetectionCheck.tsx         Immediate bad-data detection timeline
│       │   ├── StatusPanel.tsx            On-click stage detail drawer
│       │   ├── AlertPanel.tsx             Active + acknowledged alerts
│       │   ├── AlertDetail.tsx            Full alert detail modal
│       │   ├── AlertHistory.tsx           Filterable alert history table
│       │   ├── AutomationStatus.tsx       Automated response step checklist
│       │   ├── IncidentLog.tsx            ★ Pause/resume timeline with state transitions
│       │   ├── SelfHealingPanel.tsx       ★ 4-tab self-healing control surface
│       │   ├── HealthScoreGauge.tsx       ★ Circular arc health score gauge
│       │   ├── WsDevPanel.tsx             DEV-only mock circuit-breaker event panel
│       │   ├── WsStatusIndicator.tsx      WebSocket connection status chip
│       │   └── Legend.tsx                 Status colour legend
│       ├── hooks/
│       │   ├── usePipelineSimulation.ts   Metric jitter + 8-scenario simulation engine
│       │   ├── useObservability.ts        Alert lifecycle, quarantine, detection, polling
│       │   ├── useWebSocketAlerts.ts      Live circuit-breaker WS event handler
│       │   ├── useIncidentLog.ts          ★ Incident pause/resume lifecycle hook
│       │   └── useSelfHealing.ts          ★ Self-healing policy engine + DLQ retry queue
│       ├── services/
│       │   ├── websocketService.ts        WS multiplexer + DEV mock event bus
│       │   ├── pipelineService.ts         GET /api/pipeline/status
│       │   ├── alertService.ts            GET/POST /api/alerts
│       │   └── observabilityService.ts    GET /api/observability/rules
│       ├── types/
│       │   ├── pipeline.ts                Core pipeline types
│       │   ├── observability.ts           Alert, incident, circuit-breaker types
│       │   └── healing.ts                 ★ HealingAction, HealingPolicy, HealthScore, DLQRecord
│       ├── data/
│       │   ├── pipelineData.ts            Baseline mock stages + summary calculator
│       │   ├── observabilityRules.ts      Rule thresholds + incident presets
│       │   └── circuitBreakerMapping.ts   State → label/severity mapping
│       ├── context/
│       │   └── ThemeContext.tsx           Persistent dark/light theme
│       └── pages/
│           └── Dashboard.tsx             Main page — all hooks + components composed
│
├── backend/                          ← FastAPI REST + WebSocket backend
│   └── app/
│       ├── main.py                        FastAPI app + startup hooks + /ws/live
│       ├── state.py                       In-memory pipeline state (circuit, alerts, DLQ)
│       ├── websocket_manager.py           Broadcast manager for /ws/live
│       ├── routers/
│       │   ├── kpi.py                     GET /api/kpi
│       │   ├── lineage.py                 GET /api/lineage
│       │   ├── alerts.py                  GET /api/alerts
│       │   ├── incidents.py               GET /api/incidents
│       │   ├── rules.py                   CRUD /api/rules
│       │   ├── dlq.py                     GET /api/dlq
│       │   ├── timetravel.py              GET /api/iceberg/history + /scan
│       │   └── healing.py                 ★ Self-healing engine REST API
│       └── services/
│           ├── kafka_listener.py          Kafka consumer threads (raw, dlq, alerts)
│           └── iceberg_client.py          Read-only Iceberg access
│
├── producer/
│   └── generate_transactions.py      Synthetic event generator + fault injector
│
└── infra/
    └── bootstrap-kafka.sh            Kafka topic initialisation
```

★ = added in this session

---

## 4. Member 1 — Streaming Foundation

### Kafka Producer (`producer/generate_transactions.py`)

Streams mock checkout events at ~200 evt/s and deliberately injects faults:

| Fault Type     | Description                                                    |
|----------------|----------------------------------------------------------------|
| `null_amount`  | Sets `total_amount = null`                                     |
| `null_sku`     | Sets `sku = null`                                              |
| `negative_qty` | Negative quantity values                                       |
| `schema_drift` | Renames `tax_amount → tax_amt_v2`, bumps `schema_version` to 2 |
| `huge_amount`  | 50–200× spike in order value                                   |
| `bad_type`     | `quantity` set to string `"N/A"`                               |

### Kafka Topics

| Topic                 | Purpose                                              |
|-----------------------|------------------------------------------------------|
| `transactions.raw`    | Main ingest stream                                   |
| `transactions.dlq`    | Dead-letter queue — bad data + open circuit          |
| `transactions.alerts` | Observability alert events from the stream processor |

### Infrastructure
- **MinIO** — S3-compatible Iceberg data storage
- **PostgreSQL** — Iceberg SQL catalog
- **FastAPI** — REST + WebSocket backend at port 8000
- **Docker Compose** — full-stack orchestration

---

## 5. Member 2 — Observability & Self-Healing Layer

### 5.1 Live WebSocket Alerts

The frontend connects to `ws://localhost:8000/ws/live`. The backend multiplexes messages by `channel`:

| Channel           | Payload                                          |
|-------------------|--------------------------------------------------|
| `snapshot`        | Full state dump on connect                       |
| `circuit_breaker` | `{ nodeId, status: OPEN/HALF_OPEN/CLOSED, errorRate }` |
| `healing_action`  | Real-time self-healing action broadcast          |

When a `circuit_breaker` event fires:
- Pipeline node turns **red / amber** instantly
- Edges recolor to match
- `LiveAlertBanner` appears at the top
- `IncidentLog` creates a new incident entry
- `useSelfHealing` evaluates policies (e.g. auto-probe on HALF_OPEN)

### 5.2 Incident Log (`IncidentLog.tsx` + `useIncidentLog.ts`)

Tracks every pipeline pause and resume with a full lifecycle:

```
OPEN (paused) → HALF_OPEN (recovering) → CLOSED (resolved)
```

Each incident card shows:
- Severity + trigger badge (circuit_breaker / schema_drift / null_rate / …)
- Paused at / Recovery started / Resumed at / Duration / Error rate
- Expandable: technical description · 8-cell metrics grid · state-transition timeline
- Filter by status / node / trigger type
- Per-incident dismiss + bulk clear

### 5.3 Self-Healing Engine (`useSelfHealing.ts` + `SelfHealingPanel.tsx`)

**Health Score** — composite 0–100 score across all three pipeline stages:

| Component          | Weight |
|--------------------|--------|
| INGEST health      | 30%    |
| PROCESS health     | 45%    |
| SERVE health       | 25%    |

Penalized additionally by: circuit state, error rate, DLQ depth.
Displayed as a 270° SVG arc gauge with letter grade (A–F) and trend arrow.

**6 Built-in Healing Policies** (evaluated every 4 s automatically):

| Policy                    | Trigger                           | Action                              |
|---------------------------|-----------------------------------|-------------------------------------|
| Auto-Probe on Half-Open   | Circuit enters HALF_OPEN          | Send 50-record probe batch          |
| DLQ Auto-Retry            | DLQ depth ≥ 5 pending records     | Patch + replay ~70% of records      |
| Backpressure Relief       | PROCESS latency > 600 ms          | Reduce ingest rate by 30%           |
| Schema Drift Auto-Coerce  | Error rate > 20%                  | Remap `tax_amt_v2 → tax_amount`     |
| Health Score Watchdog     | Score drops below 60              | Full diagnostic probe across stages |
| Low-Throughput Boost      | INGEST < 300 evt/s                | Increase consumer batch parallelism |

All policies respect per-policy **cooldowns** and can be individually toggled from the UI.

**SelfHealingPanel** — 4 tabs:

| Tab          | Contents                                                                         |
|--------------|----------------------------------------------------------------------------------|
| **Overview** | Engine ON/OFF · Mode selector · Health gauge · KPI cards · 6 manual triggers     |
| **Audit Log**| Every action with expandable technical log, status, duration, health delta        |
| **Policies** | Live enable/disable toggle + cooldown display per policy                          |
| **DLQ Queue**| Enriched quarantined records with fault type, fix suggestion, payload inspector   |

### 5.4 Data Quality Rules

All thresholds centralized in `observabilityRules.ts` — not hardcoded in components:

| Rule                 | Node    | Warning   | Critical   | Unit    |
|----------------------|---------|-----------|------------|---------|
| Tax Amount NULL Rate | PROCESS | 10%       | 40%        | %       |
| Event Throughput     | INGEST  | 500 evt/s | 200 evt/s  | evt/s   |
| Processing Latency   | PROCESS | 500 ms    | 1000 ms    | ms      |
| Schema Drift         | PROCESS | v1 mismatch | unexpected | version |

### 5.5 Incident Simulator (5 scenarios)

| Scenario       | Node Affected | Severity | Trigger                    |
|----------------|---------------|----------|----------------------------|
| Healthy        | All           | —        | Reset / recover all         |
| High NULL Rate | PROCESS       | CRITICAL | `null_rate > 40%`           |
| Schema Drift   | PROCESS       | CRITICAL | `schema_version = 2`        |
| Low Throughput | INGEST        | WARNING  | `throughput < 500 evt/s`    |
| High Latency   | PROCESS       | WARNING  | `latency > 500 ms`          |

### 5.6 Alert Lifecycle

```
New Anomaly → ACTIVE → [Acknowledge] → ACKNOWLEDGED → [Resolve] → RESOLVED (history)
```

### 5.7 Pipeline Operational States

| State         | Meaning                                        |
|---------------|------------------------------------------------|
| `OPERATIONAL` | All stages healthy, zero active alerts         |
| `DEGRADED`    | Warning-level anomaly detected                 |
| `QUARANTINED` | Critical anomaly — one or more stages paused   |
| `RECOVERING`  | Quarantine lifted, pipeline normalizing        |

---

## 6. API Reference

### REST Endpoints

| Endpoint                    | Method       | Description                          |
|-----------------------------|--------------|--------------------------------------|
| `/api/kpi`                  | GET          | Throughput, error rate, circuit state |
| `/api/lineage`              | GET          | Lineage status snapshot              |
| `/api/alerts`               | GET          | Active + acknowledged alerts         |
| `/api/incidents`            | GET          | Incident history (last 100)          |
| `/api/rules`                | GET/POST     | Data quality rule CRUD               |
| `/api/rules/{index}`        | PATCH/DELETE | Update or remove a rule              |
| `/api/dlq`                  | GET          | Dead Letter Queue records            |
| `/api/iceberg/history`      | GET          | Iceberg snapshot history             |
| `/api/iceberg/scan`         | GET          | Scan latest or specific snapshot     |
| `/api/healing/status`       | GET          | Self-healing engine state            |
| `/api/healing/policies`     | GET          | List all healing policies            |
| `/api/healing/policies/{id}`| PATCH        | Enable/disable or tune a policy      |
| `/api/healing/probe`        | POST         | Trigger a manual circuit probe       |
| `/api/healing/dlq/retry`    | POST         | Manually retry DLQ batch             |
| `/api/healing/actions/manual`| POST        | Fire any healing action by name      |

### WebSocket — `/ws/live`

```json
{ "channel": "circuit_breaker", "event": { "nodeId": "process", "status": "OPEN", "errorRate": 0.14 } }
{ "channel": "healing_action",  "action": { "type": "circuit_probe", "status": "succeeded", "healthDelta": 12 } }
{ "channel": "snapshot",        "state": { "circuit_state": "closed", "throughput": 2100, ... } }
```

---

## 7. How to Run

### Frontend only (no backend required)

```bash
cd project/frontend
npm install
npm run dev
```

→ Dashboard at **http://localhost:5173**

Use the **Incident Simulator** panel to trigger all 5 fault scenarios.
In dev mode, the **WsDevPanel** lets you fire live circuit-breaker events without a backend.

### Full Stack (Docker Compose)

```bash
cd project
docker compose up --build
```

| Service       | URL                        |
|---------------|----------------------------|
| Dashboard     | http://localhost:5173      |
| API + Docs    | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001      |

---

## 8. Completed Features

### Streaming Foundation (Member 1)
- [x] Kafka producer — 6 fault types at configurable throughput
- [x] PyFlink stream processor — DQ rules, ML anomaly detection, circuit breaker
- [x] Apache Iceberg sink — ACID upserts + time-travel snapshots
- [x] FastAPI backend — REST + multiplexed WebSocket at `/ws/live`
- [x] Docker Compose — Kafka (KRaft), MinIO, PostgreSQL, backend, producer
- [x] Iceberg time-travel console — `/api/iceberg/history` + `/api/iceberg/scan`
- [x] `kafka_listener.py` — three background threads (raw, DLQ, alerts)

### Observability Dashboard (Member 2)
- [x] React Flow pipeline canvas — INGEST → PROCESS → SERVE, custom nodes + zoom-aware edges
- [x] Live WebSocket integration — real-time circuit-breaker events update nodes + edges instantly
- [x] `LiveAlertBanner` — ephemeral top strip on every circuit-breaker event
- [x] `WsStatusIndicator` — connection state chip (connected / reconnecting / disconnected)
- [x] `WsDevPanel` — DEV-only mock event panel (no backend needed for testing)
- [x] 6 KPI cards — Events/sec, Health, Avg Latency, Active Alerts, Critical Alerts, Quarantined
- [x] Pipeline Health Banner — OPERATIONAL / DEGRADED / QUARANTINED / RECOVERING
- [x] Incident Simulator — 5 fault scenarios with full state propagation across all hooks
- [x] Detection Check — immediate bad-data flag with detection timeline
- [x] Alert Panel — active + acknowledged alerts with Acknowledge action
- [x] Alert Detail modal — rule / node / column / expected vs actual vs threshold
- [x] Alert History — severity / status / node filter controls
- [x] Automation Status — done ✓ / pending ⏳ step checklist
- [x] Quarantine edge — dashed red + ⛔ BLOCKED label on PROCESS → SERVE
- [x] Dark / light theme with localStorage persistence

### Incident Log (Member 2)
- [x] `useIncidentLog` hook — OPEN → RECOVERING → RESOLVED lifecycle per incident
- [x] Feeds from both live WS events and scenario simulator simultaneously
- [x] `IncidentLog` component — KPI bar, filter controls, expandable rows
- [x] Per-incident: status chip, severity, trigger badge, cause headline, timing strip
- [x] Expandable detail: technical description, 8-cell metrics grid, state-transition timeline
- [x] Per-incident dismiss + bulk clear dismissed

### Self-Healing Pipeline (Member 2)
- [x] `useSelfHealing` hook — policy evaluator runs every 4 s automatically
- [x] Composite health score (0–100) with letter grade (A–F) and trend arrow
- [x] 6 built-in healing policies — all user-tunable from the UI
- [x] Circuit probe automation — auto-probe on HALF_OPEN, decide CLOSE vs REOPEN
- [x] DLQ retry queue — smart retry with fix suggestions, 70% auto-success rate
- [x] Schema coercion — auto-remap drifted fields to restore compatibility
- [x] Backpressure relief — reduce ingest rate on high Flink latency
- [x] Throughput boost — increase parallelism on low INGEST throughput
- [x] Health watchdog — diagnostic probe when score drops below 60
- [x] `HealthScoreGauge` — 270° SVG arc with per-stage bars (compact + full modes)
- [x] `SelfHealingPanel` — 4-tab UI: Overview, Audit Log, Policies, DLQ Queue
- [x] All healing actions broadcast over `/ws/live` as `healing_action` channel
- [x] `healing.py` backend router — 7 REST endpoints + asyncio background policy loop
- [x] `types/healing.ts` — full type system: HealingAction, HealingPolicy, HealthScore, DLQRecord, ProbeResult
