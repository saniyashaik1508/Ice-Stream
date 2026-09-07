/**
 * IceStream — WebSocket Service  (Day 1 foundation)
 *
 * Manages the single persistent WebSocket connection to the FastAPI backend.
 * Endpoint: ws://localhost:8000/ws/live
 *
 * The backend broadcasts multiplexed messages with a `channel` discriminator:
 *   { "channel": "snapshot",        "state": { ... } }
 *   { "channel": "circuit_breaker", "event": { "type": "circuit_breaker", "to_state": ..., ... } }
 *   { "channel": "alert",           "event": { ... } }
 *   { "channel": "dlq",             "record": { ... } }
 *   { "channel": "lineage",         "status": { ... } }
 *
 * This service:
 *   1. Opens / closes the connection
 *   2. Parses raw bytes → WsEnvelope
 *   3. Dispatches to registered per-channel listeners
 *   4. Exposes a simple subscribe/unsubscribe API
 *
 * React components use the `useWebSocketAlerts` hook — they never import this
 * service directly. This keeps all WS lifecycle code in one place.
 *
 * Day 2+: Add exponential-backoff reconnection.
 * Day 5+: Add heartbeat / ping-pong.
 */

import { CircuitBreakerEvent, WsEnvelope } from '../types/observability';
import {
  normaliseCircuitBreakerState,
  CIRCUIT_BREAKER_TO_SEVERITY,
  CIRCUIT_BREAKER_LABELS,
} from '../data/circuitBreakerMapping';

// ─── Configuration ────────────────────────────────────────────────────────────

const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  'ws://localhost:8000/ws/live';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WsChannel = WsEnvelope['channel'];

export type CircuitBreakerListener = (event: CircuitBreakerEvent) => void;
export type SnapshotListener       = (snapshot: Record<string, unknown>) => void;
export type ErrorListener          = (error: Event) => void;
export type CloseListener          = (event: CloseEvent) => void;

export type WsConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

// ─── Internal state ───────────────────────────────────────────────────────────

let _socket: WebSocket | null = null;
let _status: WsConnectionStatus = 'disconnected';

const _cbListeners  = new Set<CircuitBreakerListener>();
const _snapListeners = new Set<SnapshotListener>();
const _errListeners  = new Set<ErrorListener>();
const _closeListeners = new Set<CloseListener>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Translates the raw backend circuit_breaker envelope into the normalised
 * CircuitBreakerEvent the UI consumes.
 *
 * Backend event shape (kafka_listener.py → _watch_alerts):
 * {
 *   "type":       "circuit_breaker",
 *   "to_state":   "open" | "closed" | "half_open",
 *   "error_rate": 0.07,
 *   "message":    "...",
 *   "timestamp":  "2026-09-07T..."   (may be absent on older events)
 * }
 */
function _parseCbEvent(raw: Record<string, unknown>): CircuitBreakerEvent {
  const status = normaliseCircuitBreakerState(
    (raw['to_state'] as string | undefined) ?? 'closed'
  );

  return {
    type:      'CIRCUIT_BREAKER',
    nodeId:    'process',          // circuit breaker always guards the PROCESS stage
    status,
    severity:  CIRCUIT_BREAKER_TO_SEVERITY[status],
    message:   (raw['message'] as string | undefined)
                 ?? CIRCUIT_BREAKER_LABELS[status],
    timestamp: (raw['timestamp'] as string | undefined)
                 ?? new Date().toISOString(),
    errorRate: raw['error_rate'] as number | undefined,
  };
}

function _dispatch(envelope: WsEnvelope): void {
  switch (envelope.channel) {
    case 'circuit_breaker': {
      const raw = (envelope['event'] as Record<string, unknown>) ?? {};
      const cbEvent = _parseCbEvent(raw);
      _cbListeners.forEach(fn => fn(cbEvent));
      break;
    }
    case 'snapshot': {
      const snap = (envelope['state'] as Record<string, unknown>) ?? {};
      _snapListeners.forEach(fn => fn(snap));
      break;
    }
    // alert / dlq / lineage channels — handled by other hooks (future days)
    default:
      break;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Open the WebSocket connection. Safe to call multiple times — no-ops if already open. */
export function connect(): void {
  if (_socket && _socket.readyState <= WebSocket.OPEN) return; // already open/connecting

  _status = 'connecting';
  _socket = new WebSocket(WS_URL);

  _socket.onopen = () => {
    _status = 'connected';
    console.info('[WS] Connected to', WS_URL);
  };

  _socket.onmessage = (ev: MessageEvent) => {
    try {
      // Backend uses orjson and sends bytes; browsers receive as string or Blob.
      // ArrayBuffer / Blob paths added for completeness.
      const text =
        typeof ev.data === 'string' ? ev.data : null;
      if (!text) return; // Blob/ArrayBuffer — ignore for now (Day 5 handles binary)

      const envelope: WsEnvelope = JSON.parse(text);
      _dispatch(envelope);
    } catch (err) {
      console.warn('[WS] Failed to parse message', err);
    }
  };

  _socket.onerror = (ev: Event) => {
    _status = 'error';
    console.error('[WS] Error', ev);
    _errListeners.forEach(fn => fn(ev));
  };

  _socket.onclose = (ev: CloseEvent) => {
    _status = 'disconnected';
    console.info('[WS] Closed — code', ev.code);
    _closeListeners.forEach(fn => fn(ev));
    _socket = null;
    // Day 2: add exponential-backoff reconnect here
  };
}

/** Close the WebSocket connection cleanly. */
export function disconnect(): void {
  _socket?.close(1000, 'Client disconnected');
  _socket = null;
  _status = 'disconnected';
}

/** Current connection status (for UI indicators). */
export function getStatus(): WsConnectionStatus {
  return _status;
}

// ─── Subscription helpers ─────────────────────────────────────────────────────

/** Subscribe to circuit-breaker events. Returns an unsubscribe function. */
export function onCircuitBreaker(fn: CircuitBreakerListener): () => void {
  _cbListeners.add(fn);
  return () => _cbListeners.delete(fn);
}

/** Subscribe to the initial snapshot pushed on connect. Returns an unsubscribe function. */
export function onSnapshot(fn: SnapshotListener): () => void {
  _snapListeners.add(fn);
  return () => _snapListeners.delete(fn);
}

/** Subscribe to WebSocket errors. Returns an unsubscribe function. */
export function onError(fn: ErrorListener): () => void {
  _errListeners.add(fn);
  return () => _errListeners.delete(fn);
}

/** Subscribe to WebSocket close events. Returns an unsubscribe function. */
export function onClose(fn: CloseListener): () => void {
  _closeListeners.add(fn);
  return () => _closeListeners.delete(fn);
}

// ─── DEV ONLY — Mock event emitter ───────────────────────────────────────────
//
// Used in development when the backend is not running.
// Call `wsDevMock.fireCircuitBreaker('OPEN')` from the browser console or
// from the IncidentSimulator to test the full UI data flow without Kafka.
//
// REMOVE or tree-shake this in production builds (guarded by import.meta.env.DEV).

export const wsDevMock = {
  /**
   * Emits a fake circuit-breaker event directly into the listener set,
   * bypassing the WebSocket entirely.
   *
   * Usage (browser console):
   *   import('/src/services/websocketService.ts').then(m => m.wsDevMock.fireCircuitBreaker('OPEN'))
   *
   * Usage (from IncidentSimulator callback):
   *   wsDevMock.fireCircuitBreaker('OPEN', 'process', 0.08)
   */
  fireCircuitBreaker(
    status: 'OPEN' | 'CLOSED' | 'HALF_OPEN',
    nodeId: 'ingest' | 'process' | 'serve' = 'process',
    errorRate = 0
  ): void {
    if (!import.meta.env.DEV) {
      console.warn('[wsDevMock] Mock events are disabled outside of DEV mode.');
      return;
    }
    const event: CircuitBreakerEvent = {
      type:      'CIRCUIT_BREAKER',
      nodeId,
      status,
      severity:  CIRCUIT_BREAKER_TO_SEVERITY[status],
      message:   `[DEV MOCK] ${CIRCUIT_BREAKER_LABELS[status]}`,
      timestamp: new Date().toISOString(),
      errorRate,
    };
    console.info('[wsDevMock] Firing', event);
    _cbListeners.forEach(fn => fn(event));
  },
};
