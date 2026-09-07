/**
 * IceStream — Week 2 Observability Type System
 *
 * These types extend the pipeline.ts foundation without modifying
 * any existing Week 1 types. All new observability concerns live here.
 *
 * Future API contract endpoints:
 *   GET  /api/alerts
 *   GET  /api/alerts/history
 *   GET  /api/observability/rules
 *   POST /api/alerts/{id}/acknowledge
 *   POST /api/alerts/{id}/resolve
 *   POST /api/pipeline/{nodeId}/quarantine
 */

// ─── Extended pipeline status (superset of Week 1 PipelineStatus) ────────────
export type PipelineStatusExtended =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'degraded'
  | 'quarantined'
  | 'offline';

// Maps legacy 'error' to the new 'critical' label for display
export function toPipelineStatusExtended(
  s: string
): PipelineStatusExtended {
  if (s === 'error') return 'critical';
  return s as PipelineStatusExtended;
}

// ─── Alert system ─────────────────────────────────────────────────────────────
export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface DataQualityAnomaly {
  id: string;
  nodeId: 'ingest' | 'process' | 'serve';
  ruleName: string;
  metric: string;
  column?: string;
  expectedValue?: number | string;
  actualValue?: number | string;
  threshold?: number | string;
  severity: AlertSeverity;
  status: AlertStatus;
  detectedAt: string; // HH:MM:SS
  description: string;
}

export interface ObservabilityAlert {
  id: string;
  anomaly: DataQualityAnomaly;
  createdAt: string; // HH:MM:SS
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  notes?: string;
}

// ─── Automation pipeline ──────────────────────────────────────────────────────
export type AutomationStepStatus = 'done' | 'pending' | 'skipped';

export interface AutomationStep {
  id: string;
  label: string;
  status: AutomationStepStatus;
}

// ─── Overall observability state ──────────────────────────────────────────────
export type PipelineOperationalState =
  | 'operational'
  | 'degraded'
  | 'quarantined'
  | 'recovering'
  | 'offline';

export interface ObservabilityState {
  pipelineState: PipelineOperationalState;
  alerts: ObservabilityAlert[];
  alertHistory: ObservabilityAlert[];
  quarantinedNodes: string[];
  automationSteps: AutomationStep[];
  isLoading: boolean;
  error: string | null;
  lastPolled: string;
}

// ─── Observability rule definitions ───────────────────────────────────────────
export type RuleMetric =
  | 'null_rate'
  | 'throughput'
  | 'latency'
  | 'schema_drift';

export interface ObservabilityRule {
  id: string;
  name: string;
  metric: RuleMetric;
  nodeId: 'ingest' | 'process' | 'serve';
  column?: string;
  /** Value at which a WARNING is generated */
  warningThreshold: number | string;
  /** Value at which a CRITICAL is generated */
  criticalThreshold: number | string;
  unit: string;
  description: string;
}

// ─── Incident simulation scenarios (Week 2 extended set) ─────────────────────
export type IncidentScenario =
  | 'healthy'
  | 'high-null-rate'
  | 'schema-drift'
  | 'low-throughput'
  | 'high-latency';

export interface IncidentPreset {
  scenario: IncidentScenario;
  label: string;
  description: string;
  ruleId: string;
  affectedNodeId: 'ingest' | 'process' | 'serve';
  severity: AlertSeverity;
  metric: string;
  column?: string;
  expectedValue?: number | string;
  actualValue?: number | string;
  threshold?: number | string;
  anomalyDescription: string;
}

// ─── Alert History filter state ───────────────────────────────────────────────
export interface AlertHistoryFilter {
  severity: AlertSeverity | 'all';
  status: AlertStatus | 'all';
  nodeId: 'ingest' | 'process' | 'serve' | 'all';
}

// ─── API response contracts (for future backend integration) ──────────────────
export interface AlertsApiResponse {
  alerts: ObservabilityAlert[];
  total: number;
  timestamp: string;
}

export interface AlertHistoryApiResponse {
  history: ObservabilityAlert[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ObservabilityRulesApiResponse {
  rules: ObservabilityRule[];
}

export interface AcknowledgeAlertApiRequest {
  alertId: string;
  notes?: string;
}

export interface QuarantineNodeApiRequest {
  nodeId: string;
  reason: string;
}

// ─── Detection Check event (emitted immediately on bad-data injection) ─────────
export interface DetectionEvent {
  /** Which incident scenario caused this */
  scenario: IncidentScenario;
  /** Human-readable rule that caught the bad data */
  ruleName: string;
  /** The stage where Flink flagged the data */
  detectedAtStage: 'ingest' | 'process' | 'serve';
  severity: AlertSeverity;
  /** The field/column affected (if applicable) */
  column?: string;
  expectedValue: string;
  actualValue: string;
  threshold: string;
  /** HH:MM:SS — when bad data was injected at the source */
  injectedAt: string;
  /** HH:MM:SS — when Flink flagged the data */
  detectedAt: string;
  /** HH:MM:SS — when the alert was raised */
  alertRaisedAt: string;
  /** Simulated detection latency in ms */
  detectionLatencyMs: number;
}

// ─── Live Alert — Circuit Breaker WebSocket Types (Day 1 foundation) ──────────
//
// These types model the real-time events emitted by the backend over
// ws://localhost:8000/ws/live  (channel: "circuit_breaker").
//
// Backend shape (from kafka_listener.py _watch_alerts):
//   { "channel": "circuit_breaker", "event": { "type": "circuit_breaker",
//     "to_state": "open|closed|half_open", "error_rate": 0.07, ... } }
//
// Frontend normalises this into CircuitBreakerEvent for clean UI consumption.

/** The three states a circuit breaker can occupy (matches backend to_state values) */
export type CircuitBreakerStatus = 'OPEN' | 'CLOSED' | 'HALF_OPEN';

/** Which pipeline stage the circuit breaker protects */
export type CircuitBreakerNodeId = 'ingest' | 'process' | 'serve';

/**
 * Normalised circuit-breaker event — the canonical message format the React UI
 * works with. `websocketService.ts` translates raw backend messages into this.
 */
export interface CircuitBreakerEvent {
  /** Discriminator — always "CIRCUIT_BREAKER" on the frontend */
  type: 'CIRCUIT_BREAKER';
  /** Which pipeline node is affected */
  nodeId: CircuitBreakerNodeId;
  /** Current breaker state */
  status: CircuitBreakerStatus;
  /** Derived UI severity — set by the status→severity mapping */
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  /** Human-readable description emitted by the stream processor */
  message: string;
  /** ISO-8601 timestamp of the state transition */
  timestamp: string;
  /** Rolling error rate that triggered the transition (0–1) */
  errorRate?: number;
}

/**
 * The live-alert state slice for a single node.
 * Stored per-node in `useWebSocketAlerts`.
 */
export interface LiveAlertState {
  nodeId: CircuitBreakerNodeId;
  status: CircuitBreakerStatus;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: string;
  errorRate?: number;
  /** true while the breaker is not CLOSED */
  active: boolean;
}

/**
 * Full map of live alert states, keyed by nodeId.
 * A node absent from this map is implicitly CLOSED / healthy.
 */
export type LiveAlertMap = Partial<Record<CircuitBreakerNodeId, LiveAlertState>>;

/**
 * Raw WebSocket message envelope as sent by the backend's `/ws/live` channel.
 * Used only inside `websocketService.ts` — consumers receive CircuitBreakerEvent.
 */
export interface WsEnvelope {
  channel: 'snapshot' | 'circuit_breaker' | 'alert' | 'dlq' | 'lineage';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
