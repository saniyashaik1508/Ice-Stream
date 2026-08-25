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
