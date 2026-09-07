/**
 * IceStream — Circuit Breaker → UI Status Mapping
 *
 * Single source of truth for how a circuit-breaker state translates to:
 *   1. PipelineNode visual status  (→ PipelineNode.tsx getStatusConfig)
 *   2. Alert severity              (→ AlertPanel, DetectionCheck)
 *   3. Human-readable label        (→ any badge / tooltip)
 *
 * Keep all hardcoded values here — NEVER inside React Flow components.
 *
 * Backend emits to_state as lowercase: "open" | "closed" | "half_open"
 * Frontend normalises to uppercase: "OPEN" | "CLOSED" | "HALF_OPEN"
 */

import { CircuitBreakerStatus } from '../types/observability';
import { PipelineStatus } from '../types/pipeline';

// ─── 1. Circuit Breaker status → pipeline node visual status ─────────────────
//
//   CLOSED    → the breaker is healthy, stream flowing normally     → 'healthy'
//   HALF_OPEN → breaker is probing for recovery, partial risk       → 'warning'
//   OPEN      → breaker tripped, stream is paused / routed to DLQ  → 'error'
//                (PipelineNode renders 'error' as CRITICAL / red)

export const CIRCUIT_BREAKER_TO_NODE_STATUS: Record<CircuitBreakerStatus, PipelineStatus> = {
  CLOSED:    'healthy',
  HALF_OPEN: 'warning',
  OPEN:      'error',   // 'error' renders as CRITICAL (red) in PipelineNode
};

// ─── 2. Circuit Breaker status → alert severity ───────────────────────────────

export const CIRCUIT_BREAKER_TO_SEVERITY: Record<
  CircuitBreakerStatus,
  'INFO' | 'WARNING' | 'CRITICAL'
> = {
  CLOSED:    'INFO',
  HALF_OPEN: 'WARNING',
  OPEN:      'CRITICAL',
};

// ─── 3. Circuit Breaker status → human-readable label ────────────────────────

export const CIRCUIT_BREAKER_LABELS: Record<CircuitBreakerStatus, string> = {
  CLOSED:    'Closed — stream flowing normally',
  HALF_OPEN: 'Half-Open — recovery probe in progress',
  OPEN:      'Open — circuit tripped, stream paused',
};

// ─── 4. Backend to_state (lowercase) → frontend CircuitBreakerStatus ─────────
//
// The backend Kafka listener emits lowercase strings ("open", "closed",
// "half_open"). This normaliser converts to the uppercase enum used by the UI.

export function normaliseCircuitBreakerState(
  backendState: string
): CircuitBreakerStatus {
  switch (backendState.toLowerCase()) {
    case 'open':      return 'OPEN';
    case 'half_open': return 'HALF_OPEN';
    case 'closed':
    default:          return 'CLOSED';
  }
}
