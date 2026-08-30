/**
 * IceStream — Week 2 Observability Rule Configuration
 *
 * All thresholds and scenario presets live here — NOT hardcoded in components.
 * Edit this file to tune detection sensitivity without touching UI code.
 *
 * Future: replace with GET /api/observability/rules
 */

import {
  ObservabilityRule,
  IncidentPreset,
} from '../types/observability';

// ─── Data Quality Rules ────────────────────────────────────────────────────────

export const observabilityRules: ObservabilityRule[] = [
  {
    id: 'rule-null-tax-amount',
    name: 'Tax Amount NULL Rate',
    metric: 'null_rate',
    nodeId: 'process',
    column: 'tax_amount',
    warningThreshold: 10,
    criticalThreshold: 40,
    unit: '%',
    description:
      'Monitors the percentage of records where tax_amount is NULL. ' +
      'A high NULL rate indicates upstream data corruption or schema changes in the producer.',
  },
  {
    id: 'rule-event-throughput',
    name: 'Event Throughput',
    metric: 'throughput',
    nodeId: 'ingest',
    warningThreshold: 500,
    criticalThreshold: 200,
    unit: 'evt/s',
    description:
      'Monitors the rate of events entering the ingest layer. ' +
      'Throughput below 500 evt/s indicates Kafka lag or producer failure.',
  },
  {
    id: 'rule-processing-latency',
    name: 'Processing Latency',
    metric: 'latency',
    nodeId: 'process',
    warningThreshold: 500,
    criticalThreshold: 1000,
    unit: 'ms',
    description:
      'Monitors end-to-end processing latency through the PROCESS stage. ' +
      'Latency above 500ms indicates Flink backpressure or resource contention.',
  },
  {
    id: 'rule-schema-drift',
    name: 'Schema Drift Detection',
    metric: 'schema_drift',
    nodeId: 'process',
    column: 'schema_version',
    warningThreshold: 'v1',
    criticalThreshold: 'unexpected',
    unit: 'version',
    description:
      'Detects unexpected schema changes in the incoming transaction stream. ' +
      'Schema drift (e.g. tax_amount renamed to tax_amt_v2, schema_version=2) ' +
      'causes data loss and downstream table corruption.',
  },
];

// ─── Incident Presets (feed the Incident Simulator) ───────────────────────────

export const incidentPresets: Record<string, IncidentPreset> = {
  healthy: {
    scenario: 'healthy',
    label: 'Healthy',
    description: 'All pipeline stages operating within normal parameters.',
    ruleId: '',
    affectedNodeId: 'process',
    severity: 'info',
    metric: '',
    anomalyDescription: 'No anomalies detected. Pipeline fully operational.',
  },

  'high-null-rate': {
    scenario: 'high-null-rate',
    label: 'High NULL Rate',
    description: 'Tax Amount NULL rate exceeds critical threshold.',
    ruleId: 'rule-null-tax-amount',
    affectedNodeId: 'process',
    severity: 'critical',
    metric: 'null_rate',
    column: 'tax_amount',
    expectedValue: '< 10%',
    actualValue: '52%',
    threshold: '40%',
    anomalyDescription:
      'Tax Amount (tax_amount) contains an unusually high percentage of NULL values. ' +
      'This may indicate upstream data corruption in the e-commerce transaction producer, ' +
      'a schema change that removed the field, or a serialization issue in the Kafka producer.',
  },

  'schema-drift': {
    scenario: 'schema-drift',
    label: 'Schema Drift',
    description: 'Unexpected schema change detected in transaction stream.',
    ruleId: 'rule-schema-drift',
    affectedNodeId: 'process',
    severity: 'critical',
    metric: 'schema_drift',
    column: 'schema_version',
    expectedValue: 'schema_version=1',
    actualValue: 'schema_version=2 (tax_amt_v2)',
    threshold: 'schema_version=1',
    anomalyDescription:
      'An unannounced schema change was detected in the incoming transaction stream. ' +
      'The field "tax_amount" has been renamed to "tax_amt_v2" and schema_version has ' +
      'changed from 1 to 2. This breaks downstream Iceberg table writes and data quality assertions.',
  },

  'low-throughput': {
    scenario: 'low-throughput',
    label: 'Low Throughput',
    description: 'Events/sec below expected threshold in INGEST.',
    ruleId: 'rule-event-throughput',
    affectedNodeId: 'ingest',
    severity: 'warning',
    metric: 'throughput',
    column: undefined,
    expectedValue: '> 500 evt/s',
    actualValue: '280 evt/s',
    threshold: '500 evt/s',
    anomalyDescription:
      'The ingest layer is receiving significantly fewer events than expected. ' +
      'This may indicate a Kafka producer slowdown, consumer group rebalancing, ' +
      'or a reduction in upstream transaction activity. Downstream stages may be starved.',
  },

  'high-latency': {
    scenario: 'high-latency',
    label: 'High Latency',
    description: 'Processing latency above warning threshold.',
    ruleId: 'rule-processing-latency',
    affectedNodeId: 'process',
    severity: 'warning',
    metric: 'latency',
    column: undefined,
    expectedValue: '< 500ms',
    actualValue: '620ms',
    threshold: '500ms',
    anomalyDescription:
      'The PROCESS stage is experiencing elevated end-to-end latency. ' +
      'This may indicate Flink task manager resource exhaustion, checkpoint overhead, ' +
      'or an increase in the volume of records requiring data quality validation.',
  },
};

// ─── Automation step templates ─────────────────────────────────────────────────

export const healthyAutomationSteps = [
  { id: 'step-monitor', label: 'Monitoring active', status: 'done' as const },
  { id: 'step-no-anomaly', label: 'No anomalies detected', status: 'done' as const },
  { id: 'step-pipeline-ok', label: 'Pipeline operational', status: 'done' as const },
];

export const incidentAutomationSteps = [
  { id: 'step-detect', label: 'Anomaly detected', status: 'done' as const },
  { id: 'step-alert', label: 'Alert generated', status: 'done' as const },
  { id: 'step-pause', label: 'Downstream pipeline paused', status: 'done' as const },
  { id: 'step-quarantine', label: 'Data quarantined', status: 'done' as const },
  { id: 'step-refetch', label: 'Re-fetch initiated', status: 'pending' as const },
];

export const warningAutomationSteps = [
  { id: 'step-detect', label: 'Anomaly detected', status: 'done' as const },
  { id: 'step-alert', label: 'Alert generated', status: 'done' as const },
  { id: 'step-monitor-elevated', label: 'Elevated monitoring engaged', status: 'done' as const },
  { id: 'step-assess', label: 'Assessing pipeline impact', status: 'pending' as const },
];
