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
