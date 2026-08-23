# IceStream — Real-Time Lakehouse Observability & Data Lineage UI

> **Member 2 — Observability/UI Engineer (Week 1 Deliverable)**

A high-performance, real-time data-lineage and observability dashboard built with **React**, **React Flow**, **TypeScript**, and **Tailwind CSS**. It visually represents the end-to-end lakehouse streaming architecture from ingestion to analytical serving with live operational health metrics and full **Dark / Light Theme** switching.

---

## 1. Project Purpose

IceStream is a real-time data-quality and observability system for modern data lakehouses. The Week 1 frontend provides an intuitive visual interface that clarifies:

* **Where data enters**: Ingest layer (`Apache Kafka`)
* **Where data is processed & validated**: Stream Processing layer (`Apache Flink` + Data Quality)
* **Where data is served**: Analytical Table layer (`Apache Iceberg`)
* **Operational Health**: Instant status indicators (`HEALTHY`, `WARNING`, `ERROR`, `OFFLINE`)
* **Real-time Throughput & Latency**: Dynamic event rates and stage traversal metrics
* **Theme Support**: Seamless real-time toggle between high-contrast **Dark Mode** and crisp **Light Mode**

```text
┌─────────────────────────────────────────────────────────────┐
│ IceStream                       [Light/Dark]  ● OPERATIONAL │
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
* **Theme Management**: Custom `ThemeContext` with `localStorage` persistence
* **Styling**: Tailwind CSS (class-based dark mode), PostCSS, Autoprefixer
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

The application will start locally at `http://localhost:3000`.

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
│   │   ├── PipelineNode.tsx       # Custom React Flow node with theme support, badges & metrics
│   │   ├── PipelineHeader.tsx     # Dashboard header with clock, scenario controls, and Dark/Light toggle
│   │   ├── PipelineStats.tsx      # KPI cards (Events/sec, Health, Latency, Active Alerts)
│   │   ├── StatusPanel.tsx        # Interactive stage details drawer on node click
│   │   └── Legend.tsx             # Self-explanatory pipeline status legend
│   │
│   ├── context/
│   │   └── ThemeContext.tsx       # Persistent Theme state ('dark' | 'light')
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
│   │   └── Dashboard.tsx          # Main lineage view with adaptive React Flow canvas
│   │
│   ├── App.tsx                    # Root application component wrapped with ThemeProvider
│   ├── main.tsx                   # React DOM render entry
│   └── index.css                  # Tailwind styles, theme transitions and canvas animations
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 5. Theme Switching Feature

* **Persistent**: User selection (`dark` or `light`) is saved in browser `localStorage`.
* **Adaptive Graph**: In addition to standard HTML UI components, the **React Flow Canvas** dynamically changes its dot grid color, edge stroke/labels, minimap mask, and controls styling according to the active theme.
* **Smooth Transitions**: Smooth CSS color transitions ensure a pleasant user experience when toggling.

---

## 6. Future Backend Integration Contract

The UI is isolated from Kafka / Flink / Python backend dependencies, but is pre-configured to bind directly to a REST API endpoint like `GET /api/pipeline/status`:

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
