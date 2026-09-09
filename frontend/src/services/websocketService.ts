/**
 * IceStream — WebSocket Service  (Day 3: reconnect + status feed)
 *
 * Manages the single persistent WebSocket connection to the FastAPI backend.
 * Endpoint: ws://localhost:8000/ws/live  (or VITE_WS_URL env override)
 *
 * Backend multiplexed channel format:
 *   { "channel": "snapshot",        "state": { ... } }
 *   { "channel": "circuit_breaker", "event": { "type": "circuit_breaker", "to_state": ..., ... } }
 *   { "channel": "alert",           "event": { ... } }
 *   { "channel": "dlq",             "record": { ... } }
 *   { "channel": "lineage",         "status": { ... } }
 *
 * Day 3 additions:
 *   - Exponential-backoff auto-reconnect (1 s → 2 s → 4 s … max 30 s, up to 10 tries)
 *   - onStatusChange() listener: pushes WsConnectionStatus to subscribers
 *     immediately on every transition so the UI dot updates without polling.
 *   - onAlert() listener for the "alert" channel (new rule-violation events).
 *   - Binary (Blob / ArrayBuffer) message fallback for orjson bytes output.
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

const RECONNECT_BASE_MS   = 1_000;   // initial backoff delay
const RECONNECT_MAX_MS    = 30_000;  // cap at 30 s
const RECONNECT_MAX_TRIES = 10;      // give up after 10 consecutive failures

// ─── Public types ─────────────────────────────────────────────────────────────

export type WsChannel = WsEnvelope['channel'];

export type CircuitBreakerListener = (event: CircuitBreakerEvent) => void;
export type SnapshotListener       = (snapshot: Record<string, unknown>) => void;
export type AlertListener          = (event: Record<string, unknown>) => void;
export type StatusChangeListener   = (status: WsConnectionStatus) => void;
export type ErrorListener          = (error: Event) => void;
export type CloseListener          = (event: CloseEvent) => void;

export type WsConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// ─── Internal state ───────────────────────────────────────────────────────────

let _socket:       WebSocket | null       = null;
let _status:       WsConnectionStatus     = 'disconnected';
let _retryCount    = 0;
let _retryTimer:   ReturnType<typeof setTimeout> | null = null;
let _intentionalClose = false;   // set true when disconnect() is called explicitly

const _cbListeners:     Set<CircuitBreakerListener> = new Set();
const _snapListeners:   Set<SnapshotListener>       = new Set();
const _alertListeners:  Set<AlertListener>          = new Set();
const _statusListeners: Set<StatusChangeListener>   = new Set();
const _errListeners:    Set<ErrorListener>          = new Set();
const _closeListeners:  Set<CloseListener>          = new Set();

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _setStatus(s: WsConnectionStatus): void {
  if (_status === s) return;
  _status = s;
  _statusListeners.forEach(fn => fn(s));
}

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
 *   "timestamp":  "2026-09-07T..."
 * }
 */
function _parseCbEvent(raw: Record<string, unknown>): CircuitBreakerEvent {
  const status = normaliseCircuitBreakerState(
    (raw['to_state'] as string | undefined) ?? 'closed'
  );
  return {
    type:      'CIRCUIT_BREAKER',
    nodeId:    'process',   // circuit breaker always guards the PROCESS stage
    status,
    severity:  CIRCUIT_BREAKER_TO_SEVERITY[status],
    message:   (raw['message']   as string | undefined) ?? CIRCUIT_BREAKER_LABELS[status],
    timestamp: (raw['timestamp'] as string | undefined) ?? new Date().toISOString(),
    errorRate:  raw['error_rate'] as number | undefined,
  };
}

async function _textFromMessage(ev: MessageEvent): Promise<string | null> {
  if (typeof ev.data === 'string') return ev.data;
  // orjson on the backend sends bytes — browser receives as Blob
  if (ev.data instanceof Blob) return ev.data.text();
  // ArrayBuffer fallback
  if (ev.data instanceof ArrayBuffer)
    return new TextDecoder().decode(ev.data);
  return null;
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
    case 'alert': {
      const evt = (envelope['event'] as Record<string, unknown>) ?? {};
      _alertListeners.forEach(fn => fn(evt));
      break;
    }
    // dlq / lineage — Day 4+
    default:
      break;
  }
}

// ─── Reconnection ─────────────────────────────────────────────────────────────

function _scheduleReconnect(): void {
  if (_intentionalClose) return;
  if (_retryCount >= RECONNECT_MAX_TRIES) {
    console.warn('[WS] Max reconnect attempts reached — giving up.');
    _setStatus('error');
    return;
  }

  const delay = Math.min(
    RECONNECT_BASE_MS * Math.pow(2, _retryCount),
    RECONNECT_MAX_MS
  );
  _retryCount++;
  console.info(`[WS] Reconnecting in ${delay}ms (attempt ${_retryCount}/${RECONNECT_MAX_TRIES})`);
  _setStatus('reconnecting');

  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    _openSocket();
  }, delay);
}

// ─── Core socket open ─────────────────────────────────────────────────────────

function _openSocket(): void {
  if (_socket && _socket.readyState <= WebSocket.OPEN) return;

  _setStatus('connecting');
  _socket = new WebSocket(WS_URL);

  _socket.onopen = () => {
    _retryCount = 0;   // reset backoff on successful connect
    _setStatus('connected');
    console.info('[WS] Connected →', WS_URL);
  };

  _socket.onmessage = async (ev: MessageEvent) => {
    try {
      const text = await _textFromMessage(ev);
      if (!text) return;
      const envelope: WsEnvelope = JSON.parse(text);
      _dispatch(envelope);
    } catch (err) {
      console.warn('[WS] Failed to parse message', err);
    }
  };

  _socket.onerror = (ev: Event) => {
    _setStatus('error');
    console.error('[WS] Error', ev);
    _errListeners.forEach(fn => fn(ev));
  };

  _socket.onclose = (ev: CloseEvent) => {
    _socket = null;
    console.info('[WS] Closed — code', ev.code);
    _closeListeners.forEach(fn => fn(ev));

    if (!_intentionalClose) {
      _scheduleReconnect();
    } else {
      _setStatus('disconnected');
    }
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Open the WebSocket connection. Safe to call multiple times — no-ops if already open. */
export function connect(): void {
  _intentionalClose = false;
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }
  _openSocket();
}

/** Close the WebSocket connection cleanly and stop all reconnect attempts. */
export function disconnect(): void {
  _intentionalClose = true;
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }
  _socket?.close(1000, 'Client disconnected');
  _socket = null;
  _setStatus('disconnected');
}

/** Current connection status (for UI indicators). */
export function getStatus(): WsConnectionStatus {
  return _status;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/** Subscribe to circuit-breaker state changes. Returns an unsubscribe fn. */
export function onCircuitBreaker(fn: CircuitBreakerListener): () => void {
  _cbListeners.add(fn);
  return () => _cbListeners.delete(fn);
}

/** Subscribe to the initial snapshot pushed on connect. Returns an unsubscribe fn. */
export function onSnapshot(fn: SnapshotListener): () => void {
  _snapListeners.add(fn);
  return () => _snapListeners.delete(fn);
}

/**
 * Subscribe to live alert events (rule_violation etc.) from the "alert" channel.
 * Returns an unsubscribe fn.
 */
export function onAlert(fn: AlertListener): () => void {
  _alertListeners.add(fn);
  return () => _alertListeners.delete(fn);
}

/**
 * Subscribe to connection status changes.
 * Fires immediately with the current status on subscribe, then on every change.
 * Returns an unsubscribe fn.
 */
export function onStatusChange(fn: StatusChangeListener): () => void {
  fn(_status);   // fire immediately so caller doesn't need to call getStatus()
  _statusListeners.add(fn);
  return () => _statusListeners.delete(fn);
}

/** Subscribe to raw WebSocket error events. Returns an unsubscribe fn. */
export function onError(fn: ErrorListener): () => void {
  _errListeners.add(fn);
  return () => _errListeners.delete(fn);
}

/** Subscribe to WebSocket close events. Returns an unsubscribe fn. */
export function onClose(fn: CloseListener): () => void {
  _closeListeners.add(fn);
  return () => _closeListeners.delete(fn);
}

// ─── DEV ONLY — Mock event emitter ───────────────────────────────────────────
//
// Lets you test the full UI data-flow without a running backend.
// Usage (browser DevTools console):
//
//   // Turn PROCESS node red instantly:
//   import('/src/services/websocketService.ts').then(m => m.wsDevMock.fireCircuitBreaker('OPEN'))
//
//   // Restore to healthy:
//   import('/src/services/websocketService.ts').then(m => m.wsDevMock.fireCircuitBreaker('CLOSED'))
//
// CAUTION: only active in DEV builds.

export const wsDevMock = {
  fireCircuitBreaker(
    status: 'OPEN' | 'CLOSED' | 'HALF_OPEN',
    nodeId: 'ingest' | 'process' | 'serve' = 'process',
    errorRate = 0
  ): void {
    if (!import.meta.env.DEV) {
      console.warn('[wsDevMock] Only available in DEV mode.');
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

  /** Simulate the backend reconnecting after a drop */
  simulateReconnect(): void {
    if (!import.meta.env.DEV) return;
    _setStatus('disconnected');
    setTimeout(() => _setStatus('reconnecting'), 300);
    setTimeout(() => _setStatus('connected'), 1500);
  },
};
