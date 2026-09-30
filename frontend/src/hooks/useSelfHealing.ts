/**
 * IceStream — useSelfHealing Hook
 *
 * The brain of the self-healing system. Runs as a proactive engineering
 * discipline: it continuously evaluates pipeline health, fires automatic
 * remediations when policies are breached, and surfaces every action taken
 * with full audit trail.
 *
 * Architecture:
 *   useWebSocketAlerts  ─── circuit_breaker events
 *   usePipelineSimulation ─ stage metrics (eps, latency, status)
 *   useObservability ────── scenario / alert state
 *         │
 *         ▼
 *   useSelfHealing  ────── evaluates policies every EVAL_INTERVAL_MS
 *         │  fires HealingActions automatically
 *         │  updates HealthScore
 *         │  manages DLQ retry queue
 *         │  runs HALF_OPEN circuit probes
 *         ▼
 *   SelfHealingPanel  ──── read-only display
 *   HealingPoliciesEditor ─ user can tune thresholds
 *
 * Self-healing capabilities:
 *   1. PROACTIVE HEALTH SCORING — composite score across all 3 stages
 *   2. POLICY ENGINE — 6 built-in policies, all user-tunable
 *   3. CIRCUIT PROBE AUTOMATION — auto-send probe batches on HALF_OPEN
 *   4. DLQ RETRY QUEUE — smart retry with backoff + fix suggestions
 *   5. SCHEMA COERCION — auto-map drifted fields when safe
 *   6. BACKPRESSURE RELIEF — reduce ingest rate on Flink pressure
 *   7. RULE DISABLE/REENABLE — unblock flow on false-positive rules
 *   8. HEALING AUDIT LOG — every action recorded with timestamps
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  HealingAction,
  HealingActionType,
  HealingActionStatus,
  HealingPolicy,
  HealingEngineState,
  HealthScore,
  DLQRecord,
  ProbeResult,
} from '../types/healing';
import { CircuitBreakerEvent, IncidentScenario } from '../types/observability';
import { PipelineNodeData } from '../types/pipeline';

// ─── Constants ─────────────────────────────────────────────────────────────────

const EVAL_INTERVAL_MS      = 4_000;  // how often the policy engine evaluates
const MAX_ACTIONS           = 100;    // max actions kept in audit log
const MAX_DLQ_RECORDS       = 50;
const MAX_RETRY_ATTEMPTS    = 3;
const PROBE_SUCCESS_THRESHOLD = 0.05; // < 5% error rate = circuit closes

// ─── Built-in default healing policies ────────────────────────────────────────

const DEFAULT_POLICIES: HealingPolicy[] = [
  {
    id: 'policy-error-rate-probe',
    name: 'Auto-Probe on Half-Open Circuit',
    description:
      'When the circuit enters HALF_OPEN, automatically send a probe batch ' +
      'to check if the error rate has recovered. Closes the circuit if probe passes.',
    triggerMetric: 'circuit_state',
    threshold: 0,
    comparator: 'eq',
    action: 'circuit_probe',
    targetNode: 'process',
    cooldownSeconds: 15,
    enabled: true,
    fireCount: 0,
  },
  {
    id: 'policy-dlq-auto-retry',
    name: 'DLQ Auto-Retry',
    description:
      'When DLQ depth exceeds 5 records, automatically retry eligible records ' +
      '(those with fixable faults) back into the pipeline after applying patches.',
    triggerMetric: 'dlq_depth',
    threshold: 5,
    comparator: 'gte',
    action: 'dlq_batch_retry',
    targetNode: 'any',
    cooldownSeconds: 30,
    enabled: true,
    fireCount: 0,
  },
  {
    id: 'policy-high-latency-relief',
    name: 'Backpressure Auto-Relief',
    description:
      'When PROCESS latency exceeds 600 ms, automatically reduce the ingest ' +
      'batch rate by 30% to relieve Flink backpressure.',
    triggerMetric: 'latency_ms',
    threshold: 600,
    comparator: 'gt',
    action: 'backpressure_relief',
    targetNode: 'process',
    cooldownSeconds: 60,
    enabled: true,
    fireCount: 0,
  },
  {
    id: 'policy-schema-coerce',
    name: 'Schema Drift Auto-Coercion',
    description:
      'When a schema drift incident is detected, automatically apply field ' +
      'mapping rules (tax_amt_v2 → tax_amount) to restore downstream compatibility.',
    triggerMetric: 'error_rate',
    threshold: 0.2,
    comparator: 'gt',
    action: 'schema_coerce',
    targetNode: 'process',
    cooldownSeconds: 45,
    enabled: true,
    fireCount: 0,
  },
  {
    id: 'policy-low-health-probe',
    name: 'Health Score Watchdog',
    description:
      'When the overall health score drops below 60, run a diagnostic health ' +
      'probe across all pipeline stages and emit a remediation report.',
    triggerMetric: 'health_score',
    threshold: 60,
    comparator: 'lt',
    action: 'health_probe',
    targetNode: 'any',
    cooldownSeconds: 90,
    enabled: true,
    fireCount: 0,
  },
  {
    id: 'policy-throughput-boost',
    name: 'Low-Throughput Auto-Boost',
    description:
      'When INGEST throughput drops below 300 evt/s, automatically increase ' +
      'consumer fetch size and partition assignment to restore normal flow.',
    triggerMetric: 'throughput_eps',
    threshold: 300,
    comparator: 'lt',
    action: 'throughput_boost',
    targetNode: 'ingest',
    cooldownSeconds: 60,
    enabled: true,
    fireCount: 0,
  },
];

// ─── Health score computation ──────────────────────────────────────────────────

function computeHealthScore(
  stages: PipelineNodeData[],
  errorRate: number,
  circuitState: string,
  dlqDepth: number
): HealthScore {
  const score = (stage: PipelineNodeData): number => {
    let s = 100;
    if (stage.status === 'error')   s -= 40;
    if (stage.status === 'warning') s -= 20;
    if (stage.status === 'offline') s = 0;
    // latency penalty
    if (stage.latencyMs > 1000) s -= 15;
    else if (stage.latencyMs > 600) s -= 8;
    else if (stage.latencyMs > 400) s -= 3;
    // throughput penalty (process/serve: eps < 1500 is degraded)
    if (stage.id !== 'ingest' && stage.eventsPerSecond < 1500) s -= 5;
    if (stage.id === 'ingest' && stage.eventsPerSecond < 300) s -= 10;
    return Math.max(0, Math.min(100, s));
  };

  const ingest  = score(stages.find(s => s.id === 'ingest')!  || { status: 'healthy', latencyMs: 80, eventsPerSecond: 2000, id: 'ingest' } as PipelineNodeData);
  const process = score(stages.find(s => s.id === 'process')! || { status: 'healthy', latencyMs: 120, eventsPerSecond: 2000, id: 'process' } as PipelineNodeData);
  const serve   = score(stages.find(s => s.id === 'serve')!   || { status: 'healthy', latencyMs: 90,  eventsPerSecond: 2000, id: 'serve' } as PipelineNodeData);

  // Circuit breaker and error rate penalties
  let circuitPenalty = 0;
  if (circuitState === 'open')      circuitPenalty = 20;
  if (circuitState === 'half_open') circuitPenalty = 8;
  const errorPenalty = Math.round(errorRate * 100 * 0.8);
  const dlqPenalty   = Math.min(10, Math.floor(dlqDepth / 5));

  const overall = Math.max(
    0,
    Math.min(100, Math.round(
      ingest * 0.3 + process * 0.45 + serve * 0.25
      - circuitPenalty - errorPenalty - dlqPenalty
    ))
  );

  const grade: HealthScore['grade'] =
    overall >= 90 ? 'A' :
    overall >= 75 ? 'B' :
    overall >= 60 ? 'C' :
    overall >= 40 ? 'D' : 'F';

  return { overall, ingest, process, serve, grade, trend: 'stable', computedAt: new Date().toISOString() };
}

// ─── Action log helpers ────────────────────────────────────────────────────────

function makeId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeAction(
  type: HealingActionType,
  targetNode: HealingAction['targetNode'],
  description: string,
  log: string,
  trigger: 'automatic' | 'manual',
  policyId?: string
): HealingAction {
  return {
    id: makeId(),
    type,
    targetNode,
    description,
    log,
    status: 'running',
    startedAt: new Date().toISOString(),
    trigger,
    policyId,
  };
}

function completeAction(
  action: HealingAction,
  status: HealingActionStatus,
  healthDelta?: number,
  errorMessage?: string
): HealingAction {
  return {
    ...action,
    status,
    completedAt: new Date().toISOString(),
    healthDelta,
    errorMessage,
  };
}

// ─── DLQ record generator ──────────────────────────────────────────────────────

let _dlqCounter = 1;
function makeDLQRecord(scenario: IncidentScenario): DLQRecord {
  const faultMap: Record<string, { faultType: string; failedRule: string; fix: string }> = {
    'high-null-rate': {
      faultType: 'null_amount',
      failedRule: 'expect_column_values_to_not_be_null(tax_amount)',
      fix: 'Impute tax_amount = unit_price × quantity × 0.08',
    },
    'schema-drift': {
      faultType: 'schema_drift',
      failedRule: 'expect_column_values_to_be_of_type(int, quantity)',
      fix: 'Remap tax_amt_v2 → tax_amount; set schema_version = 1',
    },
    'low-throughput': {
      faultType: 'bad_type',
      failedRule: 'expect_column_values_to_be_positive(quantity)',
      fix: 'Parse quantity as int; reject if still non-numeric',
    },
    'high-latency': {
      faultType: 'huge_amount',
      failedRule: 'expect_column_values_to_be_between(0.01, 5000.0)(total_amount)',
      fix: 'Cap total_amount at 5000.00 and flag for manual review',
    },
  };
  const meta = faultMap[scenario] ?? faultMap['high-null-rate'];
  const idx = _dlqCounter++;
  return {
    id: `dlq-${Date.now()}-${idx}`,
    payload: {
      transaction_id: `txn-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      sku: `SKU-${Math.floor(Math.random() * 90000 + 10000)}`,
      quantity: scenario === 'high-null-rate' ? null : (scenario === 'schema-drift' ? 'N/A' : -3),
      total_amount: scenario === 'high-latency' ? 48920.5 : 129.99,
      schema_version: scenario === 'schema-drift' ? 2 : 1,
      _injected_fault: meta.faultType,
    },
    failedRule: meta.failedRule,
    faultType: meta.faultType,
    quarantinedAt: new Date().toISOString(),
    retryCount: 0,
    retryEligible: true,
    retryStatus: 'pending',
    suggestedFix: meta.fix,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SelfHealingInput {
  stages: PipelineNodeData[];
  circuitState: string;          // 'open' | 'half_open' | 'closed'
  errorRate: number;
  activeScenario: IncidentScenario;
  liveEvent: CircuitBreakerEvent | null;
}

export function useSelfHealing(input: SelfHealingInput) {
  const { stages, circuitState, errorRate, activeScenario, liveEvent } = input;

  const [enabled, setEnabled]     = useState(true);
  const [mode, setMode]           = useState<HealingEngineState['mode']>('proactive');
  const [actions, setActions]     = useState<HealingAction[]>([]);
  const [policies, setPolicies]   = useState<HealingPolicy[]>(DEFAULT_POLICIES);
  const [dlqRecords, setDlqRecords] = useState<DLQRecord[]>([]);
  const [lastProbe, setLastProbe] = useState<ProbeResult | undefined>();
  const [totalAutoResolved, setTotalAutoResolved] = useState(0);
  const [totalManualResolved] = useState(0);

  // Previous health score for trend calculation
  const prevScoreRef   = useRef<number>(100);
  const prevScenarioRef = useRef<IncidentScenario>('healthy');

  // Compute live health score
  const healthScore: HealthScore = (() => {
    const hs = computeHealthScore(stages, errorRate, circuitState, dlqRecords.length);
    const prev = prevScoreRef.current;
    const trend: HealthScore['trend'] =
      hs.overall > prev + 2 ? 'improving' :
      hs.overall < prev - 2 ? 'degrading' : 'stable';
    return { ...hs, trend };
  })();

  // ── Emit an action into the audit log ────────────────────────────────────────
  const emitAction = useCallback((action: HealingAction) => {
    setActions(prev => [action, ...prev].slice(0, MAX_ACTIONS));
  }, []);

  const finalizeAction = useCallback(
    (id: string, status: HealingActionStatus, delta?: number, err?: string) => {
      setActions(prev =>
        prev.map(a => a.id === id ? completeAction(a, status, delta, err) : a)
      );
      if (status === 'succeeded') {
        setTotalAutoResolved(n => n + 1);
        prevScoreRef.current = healthScore.overall;
      }
    },
    [healthScore.overall]
  );

  // ── Simulate a circuit probe ──────────────────────────────────────────────────
  const runCircuitProbe = useCallback((policyId?: string, manual = false) => {
    const action = makeAction(
      'circuit_probe',
      'process',
      'HALF-OPEN probe: sending 50-record test batch through PROCESS stage',
      'Dispatching probe batch with error-rate telemetry. Waiting for validation result…',
      manual ? 'manual' : 'automatic',
      policyId
    );
    emitAction(action);

    // Simulate probe completion (800–1800 ms)
    const delay = 800 + Math.random() * 1000;
    setTimeout(() => {
      const probeErrorRate = errorRate * (0.4 + Math.random() * 0.4); // probe sees lower rate
      const succeeded = probeErrorRate < PROBE_SUCCESS_THRESHOLD;
      const result: ProbeResult = {
        probeId: action.id,
        nodeId: 'process',
        sentAt: action.startedAt,
        completedAt: new Date().toISOString(),
        probeSize: 50,
        passed: Math.round(50 * (1 - probeErrorRate)),
        observedErrorRate: probeErrorRate,
        succeeded,
        decision: succeeded ? 'close_circuit' : errorRate > 0.15 ? 'reopen_circuit' : 'extend_probe',
      };
      setLastProbe(result);
      const logLine = succeeded
        ? `Probe PASSED — observed error rate ${(probeErrorRate * 100).toFixed(1)}% < 5% threshold. Recommending CLOSE.`
        : `Probe FAILED — observed error rate ${(probeErrorRate * 100).toFixed(1)}% ≥ 5% threshold. Circuit will REOPEN.`;
      finalizeAction(action.id, succeeded ? 'succeeded' : 'failed', succeeded ? +8 : 0, succeeded ? undefined : logLine);
    }, delay);
  }, [errorRate, emitAction, finalizeAction]);

  // ── DLQ batch retry ────────────────────────────────────────────────────────
  const retryDLQBatch = useCallback((policyId?: string, manual = false) => {
    const eligible = dlqRecords.filter(r => r.retryEligible && r.retryStatus === 'pending' && r.retryCount < MAX_RETRY_ATTEMPTS);
    if (eligible.length === 0) return;

    const action = makeAction(
      'dlq_batch_retry',
      'system',
      `DLQ auto-retry: replaying ${eligible.length} fixable records with patch applied`,
      `Applying suggested fixes to ${eligible.length} records:\n` +
        eligible.slice(0, 3).map(r => `  • ${r.id}: ${r.suggestedFix}`).join('\n') +
        (eligible.length > 3 ? `\n  • …and ${eligible.length - 3} more` : ''),
      manual ? 'manual' : 'automatic',
      policyId
    );
    emitAction(action);

    // Mark all as retrying
    setDlqRecords(prev =>
      prev.map(r =>
        eligible.some(e => e.id === r.id)
          ? { ...r, retryStatus: 'retrying', retryCount: r.retryCount + 1, lastRetriedAt: new Date().toISOString() }
          : r
      )
    );

    // Resolve after delay: ~70% succeed, ~30% exhaust
    setTimeout(() => {
      const succeeded = Math.floor(eligible.length * 0.7);
      setDlqRecords(prev =>
        prev.map((r) => {
          if (!eligible.some(e => e.id === r.id)) return r;
          const idx = eligible.findIndex(e => e.id === r.id);
          return { ...r, retryStatus: idx < succeeded ? 'succeeded' : r.retryCount >= MAX_RETRY_ATTEMPTS ? 'exhausted' : 'pending' };
        })
      );
      finalizeAction(
        action.id,
        'succeeded',
        +5,
      );
    }, 1500 + Math.random() * 1000);
  }, [dlqRecords, emitAction, finalizeAction]);

  // ── Schema coercion ────────────────────────────────────────────────────────
  const runSchemaCoercion = useCallback((policyId?: string, manual = false) => {
    const action = makeAction(
      'schema_coerce',
      'process',
      'Schema coercion: remapping drifted fields to expected schema v1',
      'Applying field mapping rule:\n' +
        '  • tax_amt_v2 → tax_amount (rename)\n' +
        '  • schema_version = 2 → 1 (force downgrade)\n' +
        '  • Registering updated Avro schema in Schema Registry\n' +
        '  • Flushing schema cache in PROCESS stage',
      manual ? 'manual' : 'automatic',
      policyId
    );
    emitAction(action);
    setTimeout(() => finalizeAction(action.id, 'succeeded', +12), 1200);
  }, [emitAction, finalizeAction]);

  // ── Backpressure relief ────────────────────────────────────────────────────
  const runBackpressureRelief = useCallback((policyId?: string, manual = false) => {
    const action = makeAction(
      'backpressure_relief',
      'ingest',
      'Backpressure relief: reducing ingest rate by 30% to let Flink catch up',
      'Setting Kafka consumer fetch.max.bytes = 70% of current value.\n' +
        'Reducing partition assignment from 12 → 8 partitions.\n' +
        'Expected latency improvement: 200–400 ms within 2 evaluation windows.',
      manual ? 'manual' : 'automatic',
      policyId
    );
    emitAction(action);
    setTimeout(() => finalizeAction(action.id, 'succeeded', +7), 1000);
  }, [emitAction, finalizeAction]);

  // ── Throughput boost ───────────────────────────────────────────────────────
  const runThroughputBoost = useCallback((policyId?: string, manual = false) => {
    const action = makeAction(
      'throughput_boost',
      'ingest',
      'Throughput boost: increasing consumer batch size and parallelism',
      'Setting fetch.min.bytes = 2× current value.\n' +
        'Increasing consumer group parallelism: 4 → 6 threads.\n' +
        'Adjusting max.poll.records to 800.\n' +
        'Expected throughput recovery: 15–30 seconds.',
      manual ? 'manual' : 'automatic',
      policyId
    );
    emitAction(action);
    setTimeout(() => finalizeAction(action.id, 'succeeded', +6), 900);
  }, [emitAction, finalizeAction]);

  // ── Health probe ───────────────────────────────────────────────────────────
  const runHealthProbe = useCallback((policyId?: string, manual = false) => {
    const action = makeAction(
      'health_probe',
      'system',
      `Health watchdog: diagnostic probe across all stages (score=${healthScore.overall})`,
      `Running lightweight health checks:\n` +
        `  • INGEST: ${healthScore.ingest}/100 — checking Kafka lag + consumer group\n` +
        `  • PROCESS: ${healthScore.process}/100 — checking Flink checkpoint lag\n` +
        `  • SERVE: ${healthScore.serve}/100 — checking Iceberg commit queue\n` +
        `  • Error rate: ${(errorRate * 100).toFixed(1)}%\n` +
        `Generating remediation report…`,
      manual ? 'manual' : 'automatic',
      policyId
    );
    emitAction(action);
    setTimeout(() => finalizeAction(action.id, 'succeeded', +3), 1600);
  }, [healthScore, errorRate, emitAction, finalizeAction]);

  // ── Policy evaluator ────────────────────────────────────────────────────────
  const evaluatePolicies = useCallback(() => {
    if (!enabled || mode === 'manual') return;

    const nowMs = Date.now();
    const processStage = stages.find(s => s.id === 'process');
    const ingestStage  = stages.find(s => s.id === 'ingest');

    setPolicies(prevPolicies =>
      prevPolicies.map(policy => {
        if (!policy.enabled) return policy;

        // Check cooldown
        if (policy.lastFiredAt) {
          const elapsed = (nowMs - new Date(policy.lastFiredAt).getTime()) / 1000;
          if (elapsed < policy.cooldownSeconds) return policy;
        }

        // Evaluate condition
        let conditionMet = false;
        switch (policy.triggerMetric) {
          case 'circuit_state':
            conditionMet = circuitState === 'half_open';
            break;
          case 'dlq_depth':
            conditionMet = dlqRecords.filter(r => r.retryStatus === 'pending').length >= policy.threshold;
            break;
          case 'latency_ms':
            conditionMet = !!processStage && applyComparator(processStage.latencyMs, policy.comparator, policy.threshold);
            break;
          case 'throughput_eps':
            conditionMet = !!ingestStage && applyComparator(ingestStage.eventsPerSecond, policy.comparator, policy.threshold);
            break;
          case 'error_rate':
            conditionMet = applyComparator(errorRate, policy.comparator, policy.threshold);
            break;
          case 'health_score':
            conditionMet = applyComparator(healthScore.overall, policy.comparator, policy.threshold);
            break;
        }

        if (!conditionMet) return policy;

        // Fire the action
        switch (policy.action) {
          case 'circuit_probe':      setTimeout(() => runCircuitProbe(policy.id), 200); break;
          case 'dlq_batch_retry':    setTimeout(() => retryDLQBatch(policy.id), 300); break;
          case 'schema_coerce':      setTimeout(() => runSchemaCoercion(policy.id), 400); break;
          case 'backpressure_relief':setTimeout(() => runBackpressureRelief(policy.id), 250); break;
          case 'throughput_boost':   setTimeout(() => runThroughputBoost(policy.id), 250); break;
          case 'health_probe':       setTimeout(() => runHealthProbe(policy.id), 500); break;
          default: break;
        }

        return { ...policy, lastFiredAt: new Date().toISOString(), fireCount: policy.fireCount + 1 };
      })
    );
  }, [
    enabled, mode, stages, circuitState, errorRate, dlqRecords, healthScore.overall,
    runCircuitProbe, retryDLQBatch, runSchemaCoercion, runBackpressureRelief,
    runThroughputBoost, runHealthProbe,
  ]);

  // ── Evaluation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(evaluatePolicies, EVAL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, evaluatePolicies]);

  // ── React to scenario changes ─────────────────────────────────────────────
  useEffect(() => {
    if (activeScenario === prevScenarioRef.current) return;
    prevScenarioRef.current = activeScenario;

    if (activeScenario === 'healthy') {
      // Clear retrying DLQ records — they were resolved
      setDlqRecords(prev => prev.map(r =>
        r.retryStatus === 'pending' || r.retryStatus === 'retrying'
          ? { ...r, retryStatus: 'succeeded' }
          : r
      ));
      return;
    }

    // Seed DLQ with a few records matching the scenario
    const count = activeScenario === 'high-null-rate' ? 8 : activeScenario === 'schema-drift' ? 6 : 3;
    const newRecords: DLQRecord[] = Array.from({ length: count }, () => makeDLQRecord(activeScenario));
    setDlqRecords(prev => [...newRecords, ...prev].slice(0, MAX_DLQ_RECORDS));
  }, [activeScenario]);

  // ── React to live WS circuit-breaker events ──────────────────────────────
  useEffect(() => {
    if (!liveEvent) return;
    if (liveEvent.status === 'OPEN') {
      // Seed a few DLQ records for the live event
      const newRecords: DLQRecord[] = Array.from({ length: 4 }, () => makeDLQRecord('high-null-rate'));
      setDlqRecords(prev => [...newRecords, ...prev].slice(0, MAX_DLQ_RECORDS));
    }
  }, [liveEvent]);

  // ── Update health score trend ──────────────────────────────────────────────
  useEffect(() => {
    prevScoreRef.current = healthScore.overall;
  });

  // ── Manual action triggers ─────────────────────────────────────────────────
  const manualCircuitProbe    = useCallback(() => runCircuitProbe(undefined, true),    [runCircuitProbe]);
  const manualDLQRetry        = useCallback(() => retryDLQBatch(undefined, true),      [retryDLQBatch]);
  const manualSchemaCoerce    = useCallback(() => runSchemaCoercion(undefined, true),  [runSchemaCoercion]);
  const manualBackpressure    = useCallback(() => runBackpressureRelief(undefined, true), [runBackpressureRelief]);
  const manualThroughputBoost = useCallback(() => runThroughputBoost(undefined, true), [runThroughputBoost]);
  const manualHealthProbe     = useCallback(() => runHealthProbe(undefined, true),     [runHealthProbe]);

  const toggleEnabled = useCallback(() => setEnabled(v => !v), []);
  const setHealingMode = useCallback((m: HealingEngineState['mode']) => setMode(m), []);

  const updatePolicy = useCallback((id: string, patch: Partial<HealingPolicy>) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const dismissDLQRecord = useCallback((id: string) => {
    setDlqRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const clearSucceededActions = useCallback(() => {
    setActions(prev => prev.filter(a => a.status !== 'succeeded'));
  }, []);

  // Derived
  const pendingDLQ   = dlqRecords.filter(r => r.retryStatus === 'pending').length;
  const runningCount = actions.filter(a => a.status === 'running').length;
  const lastAction   = actions[0] ?? null;

  return {
    // State
    enabled,
    mode,
    actions,
    policies,
    healthScore,
    dlqRecords,
    lastProbe,
    totalAutoResolved,
    totalManualResolved,
    pendingDLQ,
    runningCount,
    lastAction,

    // Manual triggers
    manualCircuitProbe,
    manualDLQRetry,
    manualSchemaCoerce,
    manualBackpressure,
    manualThroughputBoost,
    manualHealthProbe,

    // Controls
    toggleEnabled,
    setHealingMode,
    updatePolicy,
    dismissDLQRecord,
    clearSucceededActions,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function applyComparator(value: number, comparator: HealingPolicy['comparator'], threshold: number): boolean {
  switch (comparator) {
    case 'gt':  return value > threshold;
    case 'lt':  return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq':  return value === threshold;
    default: return false;
  }
}
