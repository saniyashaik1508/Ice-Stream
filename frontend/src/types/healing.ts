/**
 * IceStream — Self-Healing System Type Definitions
 *
 * Models every concept the self-healing engine introduces:
 *   • HealingAction     — a single remediation step (retry, patch, quarantine, reroute…)
 *   • HealingPolicy     — a user-configurable rule that triggers actions automatically
 *   • HealingEngineState — the live state of the self-healing engine
 *   • HealthScore       — a 0–100 composite score across Ingest / Process / Serve
 *   • DLQRecord         — an enriched Dead Letter Queue entry with retry context
 *   • ProbeResult       — result of a HALF_OPEN circuit probe
 */

// ─── Health Score ─────────────────────────────────────────────────────────────

/** Per-stage and aggregate health score (0–100) */
export interface HealthScore {
  overall: number;          // weighted composite
  ingest: number;
  process: number;
  serve: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'degrading';
  computedAt: string;       // ISO-8601
}

// ─── Healing Actions ──────────────────────────────────────────────────────────

/** Every action the self-healing engine can take */
export type HealingActionType =
  | 'circuit_probe'           // send a test-batch through a HALF_OPEN circuit
  | 'dlq_retry'               // replay a DLQ record back into the pipeline
  | 'dlq_batch_retry'         // replay all retryable DLQ records
  | 'rule_disable'            // temporarily disable a failing rule to unblock flow
  | 'rule_reenable'           // re-enable a previously disabled rule
  | 'schema_coerce'           // auto-map a drifted field to the expected schema
  | 'backpressure_relief'     // reduce ingest rate to relieve Flink pressure
  | 'throughput_boost'        // increase batch size / parallelism
  | 'quarantine_release'      // release a quarantined node back to healthy
  | 'alert_suppress'          // suppress noisy alerts below the noise floor
  | 'snapshot_rollback'       // roll the Iceberg table back to a clean snapshot
  | 'health_probe';           // lightweight health check on a stage

/** Outcome of a single healing action */
export type HealingActionStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped';

/** A single healing action record */
export interface HealingAction {
  id: string;
  type: HealingActionType;
  /** Which pipeline stage this action targets */
  targetNode: 'ingest' | 'process' | 'serve' | 'system';
  /** Human-readable description of what the action did */
  description: string;
  /** Detailed technical log of the action */
  log: string;
  status: HealingActionStatus;
  /** ISO-8601 when the action was initiated */
  startedAt: string;
  /** ISO-8601 when the action completed (succeeded or failed) */
  completedAt?: string;
  /** What triggered this action */
  trigger: 'automatic' | 'manual';
  /** Which policy triggered it (undefined if manual) */
  policyId?: string;
  /** Health score delta after the action completed */
  healthDelta?: number;
  /** Error message if the action failed */
  errorMessage?: string;
}

// ─── Healing Policies ─────────────────────────────────────────────────────────

/**
 * A user-configurable healing policy.
 * When the `condition` is met, the engine fires `action` automatically.
 */
export interface HealingPolicy {
  id: string;
  name: string;
  description: string;
  /** The metric or event that triggers evaluation */
  triggerMetric:
    | 'error_rate'
    | 'null_rate'
    | 'latency_ms'
    | 'throughput_eps'
    | 'dlq_depth'
    | 'circuit_state'
    | 'health_score';
  /** Threshold that must be breached to fire the action */
  threshold: number;
  /** Comparison direction */
  comparator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  /** Action to take when the condition is met */
  action: HealingActionType;
  /** Node this policy applies to */
  targetNode: 'ingest' | 'process' | 'serve' | 'any';
  /** Minimum seconds between consecutive firings of this policy */
  cooldownSeconds: number;
  enabled: boolean;
  /** ISO-8601 when this policy last fired */
  lastFiredAt?: string;
  /** How many times this policy has fired in total */
  fireCount: number;
}

// ─── DLQ Enriched Record ──────────────────────────────────────────────────────

/** An enriched Dead Letter Queue record with retry context */
export interface DLQRecord {
  id: string;
  /** Original Kafka offset */
  offset?: number;
  /** The raw record that failed validation */
  payload: Record<string, unknown>;
  /** Which rule caught this record */
  failedRule: string;
  /** The fault type injected by the producer */
  faultType?: string;
  /** ISO-8601 when the record was quarantined */
  quarantinedAt: string;
  /** How many retry attempts have been made */
  retryCount: number;
  /** ISO-8601 of the last retry attempt */
  lastRetriedAt?: string;
  /** Whether the record is eligible for auto-retry */
  retryEligible: boolean;
  /** Current retry status */
  retryStatus: 'pending' | 'retrying' | 'succeeded' | 'exhausted' | 'manual_hold';
  /** Estimated fix: what the engine will patch to make the record valid */
  suggestedFix?: string;
}

// ─── Circuit Probe Result ─────────────────────────────────────────────────────

/** Result of a circuit probe sent through a HALF_OPEN breaker */
export interface ProbeResult {
  probeId: string;
  nodeId: 'ingest' | 'process' | 'serve';
  sentAt: string;
  completedAt?: string;
  /** How many records were sent in the probe batch */
  probeSize: number;
  /** How many passed data quality validation */
  passed: number;
  /** Error rate observed during the probe */
  observedErrorRate: number;
  /** Whether the probe succeeded (error rate < close threshold) */
  succeeded: boolean;
  /** Next action: close the circuit or re-open it */
  decision: 'close_circuit' | 'reopen_circuit' | 'extend_probe';
}

// ─── Self-Healing Engine State ────────────────────────────────────────────────

/**
 * The complete live state of the self-healing engine.
 * This is the single source of truth consumed by all UI components.
 */
export interface HealingEngineState {
  /** Whether autonomous healing is active */
  enabled: boolean;
  /** Overall healing mode */
  mode: 'proactive' | 'reactive' | 'manual';
  /** Recent healing actions (newest first) */
  actions: HealingAction[];
  /** All configured healing policies */
  policies: HealingPolicy[];
  /** Current health score */
  healthScore: HealthScore;
  /** Enriched DLQ records */
  dlqRecords: DLQRecord[];
  /** Most recent circuit probe result */
  lastProbe?: ProbeResult;
  /** ISO-8601 when the engine last evaluated its policies */
  lastEvaluatedAt: string;
  /** Count of issues the engine has resolved automatically */
  totalAutoResolved: number;
  /** Count of issues that required manual intervention */
  totalManualResolved: number;
}

// ─── Self-healing event for the action log ────────────────────────────────────

/** Emitted when a healing action fires — for live UI streaming */
export interface HealingEvent {
  type: 'HEALING_ACTION';
  action: HealingAction;
  healthScoreAfter?: number;
  timestamp: string;
}
