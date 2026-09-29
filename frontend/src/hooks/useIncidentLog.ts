/**
 * IceStream — useIncidentLog Hook
 *
 * Builds a detailed, per-incident timeline by listening to:
 *   1. Live circuit-breaker WebSocket events (OPEN → HALF_OPEN → CLOSED)
 *   2. Observability scenario injections (high-null-rate, schema-drift, …)
 *
 * Each incident tracks:
 *   - WHY the pipeline paused (cause, error rate, rule violated)
 *   - WHEN it paused (pausedAt ISO timestamp)
 *   - The full state-transition history (OPEN → HALF_OPEN → CLOSED)
 *   - WHEN recovery started (recoveryStartedAt)
 *   - WHEN it fully resumed (resumedAt)
 *   - How long the outage lasted (computed from pause/resume times)
 *
 * Architecture:
 *   kafka_listener.py → WS circuit_breaker channel
 *         │
 *         ▼
 *   useWebSocketAlerts.handleCircuitBreaker
 *         │  (circuit-breaker events re-exposed via onExternalEvent callback)
 *         ▼
 *   useIncidentLog.handleCircuitBreakerEvent
 *         │  open incidents mutated in place; new incidents created on OPEN
 *         ▼
 *   IncidentLog.tsx  (read-only display)
 *
 * Scenario injections go through applyScenarioIncident() which is called from
 * Dashboard.tsx when the IncidentSimulator fires.
 */

import { useState, useCallback, useRef } from 'react';
import {
  IncidentLogEntry,
  IncidentStateTransition,
  IncidentTrigger,
  IncidentLifecycleStatus,
  CircuitBreakerEvent,
  IncidentScenario,
} from '../types/observability';

// ─── Cause-message helpers ────────────────────────────────────────────────────

const SCENARIO_CAUSE: Record<IncidentScenario, { cause: string; details: string; trigger: IncidentTrigger }> = {
  healthy: {
    cause: 'Pipeline restored to healthy state',
    details: 'All data quality rules passing. Error rate within bounds.',
    trigger: 'circuit_breaker',
  },
  'high-null-rate': {
    cause: 'Null rate exceeded critical threshold on transaction_id column',
    details:
      'Rule: expect_column_values_to_not_be_null(transaction_id). ' +
      'Observed null rate: 34 % (threshold: 5 %). Circuit breaker tripped after ' +
      'error window exceeded. All records routed to DLQ until rate recovers.',
    trigger: 'high_null_rate',
  },
  'schema-drift': {
    cause: 'Schema drift detected — unexpected field types received from producer',
    details:
      'Rule: expect_column_values_to_be_of_type(int, quantity). ' +
      'Observed type: STRING (expected: INT). Flink deserialization failures ' +
      'caused cascading DLQ routing. Pipeline paused to prevent data corruption.',
    trigger: 'schema_drift',
  },
  'low-throughput': {
    cause: 'Ingest throughput dropped below warning floor',
    details:
      'Rule: expect_throughput_above(50 msg/s). ' +
      'Observed: 12 msg/s for 3 consecutive windows. ' +
      'Possible upstream producer slowdown or Kafka broker connectivity issue.',
    trigger: 'low_throughput',
  },
  'high-latency': {
    cause: 'Flink processing latency exceeded SLA threshold',
    details:
      'Rule: expect_p95_latency_below(500 ms). ' +
      'Observed p95: 1 420 ms. Likely cause: GC pressure or watermark stall ' +
      'in the Flink window operator. Consumer lag increasing.',
    trigger: 'high_latency',
  },
};

function buildCauseFromCbEvent(event: CircuitBreakerEvent): { cause: string; details: string } {
  const rateStr =
    event.errorRate !== undefined ? ` (error rate: ${(event.errorRate * 100).toFixed(1)} %)` : '';

  switch (event.status) {
    case 'OPEN':
      return {
        cause: `Circuit breaker OPEN — pipeline paused${rateStr}`,
        details:
          event.message ||
          `Rolling error rate exceeded the trip threshold${rateStr}. ` +
            'All records are being routed to the Dead Letter Queue (DLQ) ' +
            'until the error rate recovers below the close threshold.',
      };
    case 'HALF_OPEN':
      return {
        cause: `Circuit breaker HALF-OPEN — recovery probe in progress${rateStr}`,
        details:
          event.message ||
          `Cooldown period elapsed. Allowing a limited probe batch through${rateStr}. ` +
            'Pipeline will close (resume fully) if probe succeeds, ' +
            'or re-open if the error rate spikes again.',
      };
    case 'CLOSED':
      return {
        cause: 'Circuit breaker CLOSED — pipeline fully resumed',
        details:
          event.message ||
          `Error rate recovered below close threshold${rateStr}. ` +
            'Normal stream processing resumed. DLQ routing disabled.',
      };
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateIncidentId(): string {
  return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIncidentLog() {
  const [incidents, setIncidents] = useState<IncidentLogEntry[]>([]);

  /**
   * Ref-based map of nodeId → in-progress incident id so we can mutate the
   * correct incident when HALF_OPEN / CLOSED events arrive.
   */
  const openIncidentIds = useRef<Map<string, string>>(new Map());

  // ── Handle live circuit-breaker WS event ──────────────────────────────────
  const handleCircuitBreakerEvent = useCallback((event: CircuitBreakerEvent) => {
    const ts = nowIso();
    const { cause, details } = buildCauseFromCbEvent(event);

    const transition: IncidentStateTransition = {
      toState: event.status,
      at: ts,
      errorRate: event.errorRate,
      message: event.message || cause,
    };

    if (event.status === 'OPEN') {
      // ── New incident ────────────────────────────────────────────────────
      const id = generateIncidentId();
      openIncidentIds.current.set(event.nodeId, id);

      const entry: IncidentLogEntry = {
        id,
        nodeId: event.nodeId,
        trigger: 'circuit_breaker',
        cause,
        details,
        pausedAt: ts,
        errorRateAtPause: event.errorRate,
        stateHistory: [transition],
        status: 'open',
        dismissed: false,
        severity: event.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      };
      setIncidents(prev => [entry, ...prev]);

    } else if (event.status === 'HALF_OPEN') {
      // ── Update existing open incident → recovering ──────────────────────
      const existingId = openIncidentIds.current.get(event.nodeId);
      if (existingId) {
        setIncidents(prev =>
          prev.map(inc =>
            inc.id === existingId
              ? {
                  ...inc,
                  status: 'recovering' as IncidentLifecycleStatus,
                  recoveryStartedAt: ts,
                  stateHistory: [...inc.stateHistory, transition],
                  cause: `[Recovering] ${inc.cause}`,
                }
              : inc
          )
        );
      } else {
        // Orphan HALF_OPEN (e.g., from snapshot on fresh page load)
        const id = generateIncidentId();
        openIncidentIds.current.set(event.nodeId, id);
        const entry: IncidentLogEntry = {
          id,
          nodeId: event.nodeId,
          trigger: 'circuit_breaker',
          cause,
          details,
          pausedAt: ts,
          recoveryStartedAt: ts,
          errorRateAtPause: event.errorRate,
          stateHistory: [transition],
          status: 'recovering',
          dismissed: false,
          severity: 'WARNING',
        };
        setIncidents(prev => [entry, ...prev]);
      }

    } else if (event.status === 'CLOSED') {
      // ── Close existing incident → resolved ─────────────────────────────
      const existingId = openIncidentIds.current.get(event.nodeId);
      if (existingId) {
        openIncidentIds.current.delete(event.nodeId);
        setIncidents(prev =>
          prev.map(inc =>
            inc.id === existingId
              ? {
                  ...inc,
                  status: 'resolved' as IncidentLifecycleStatus,
                  resumedAt: ts,
                  errorRateAtResume: event.errorRate,
                  stateHistory: [...inc.stateHistory, transition],
                }
              : inc
          )
        );
      }
      // If no open incident for this node, a CLOSED event is a no-op
    }
  }, []);

  // ── Handle scenario injection (from Incident Simulator) ───────────────────
  const applyScenarioIncident = useCallback(
    (scenario: IncidentScenario, nodeId: string = 'process') => {
      if (scenario === 'healthy') {
        // Close any open scenario-triggered incidents for all nodes
        const ts = nowIso();
        setIncidents(prev =>
          prev.map(inc => {
            if (inc.status === 'open' || inc.status === 'recovering') {
              openIncidentIds.current.delete(inc.nodeId);
              return {
                ...inc,
                status: 'resolved' as IncidentLifecycleStatus,
                resumedAt: ts,
                stateHistory: [
                  ...inc.stateHistory,
                  {
                    toState: 'CLOSED' as const,
                    at: ts,
                    message: 'Scenario reset to healthy — pipeline resumed',
                  },
                ],
              };
            }
            return inc;
          })
        );
        return;
      }

      const meta = SCENARIO_CAUSE[scenario];
      if (!meta) return;

      const ts = nowIso();
      const id = generateIncidentId();
      // Derive nodeId from scenario (overriding the default 'process' where appropriate)
      const affectedNode =
        scenario === 'low-throughput'
          ? 'ingest'
          : nodeId;

      openIncidentIds.current.set(affectedNode, id);

      const entry: IncidentLogEntry = {
        id,
        nodeId: affectedNode,
        trigger: meta.trigger,
        cause: meta.cause,
        details: meta.details,
        pausedAt: ts,
        stateHistory: [
          {
            toState: 'OPEN',
            at: ts,
            message: meta.cause,
          },
        ],
        status: 'open',
        dismissed: false,
        severity: scenario === 'low-throughput' || scenario === 'high-latency' ? 'WARNING' : 'CRITICAL',
      };
      setIncidents(prev => [entry, ...prev]);
    },
    []
  );

  // ── Dismiss an incident (UI only — does not affect pipeline state) ─────────
  const dismissIncident = useCallback((incidentId: string) => {
    setIncidents(prev =>
      prev.map(inc => (inc.id === incidentId ? { ...inc, dismissed: true } : inc))
    );
  }, []);

  // ── Clear all dismissed incidents ──────────────────────────────────────────
  const clearDismissed = useCallback(() => {
    setIncidents(prev => prev.filter(inc => !inc.dismissed));
  }, []);

  // ── Derived counts ─────────────────────────────────────────────────────────
  const openCount      = incidents.filter(i => i.status === 'open'      && !i.dismissed).length;
  const recoverCount   = incidents.filter(i => i.status === 'recovering' && !i.dismissed).length;
  const resolvedCount  = incidents.filter(i => i.status === 'resolved'   && !i.dismissed).length;

  return {
    incidents,
    openCount,
    recoverCount,
    resolvedCount,
    handleCircuitBreakerEvent,
    applyScenarioIncident,
    dismissIncident,
    clearDismissed,
  };
}
