/**
 * IceStream — useWebSocketAlerts Hook  (Day 1 foundation)
 *
 * Manages the live circuit-breaker alert state driven by the WebSocket feed.
 * This hook is the single owner of `liveAlerts` — it is the ONLY place that
 * calls `websocketService.connect()` and `websocketService.disconnect()`.
 *
 * State shape:
 *   liveAlerts: LiveAlertMap   — per-node circuit-breaker states
 *   wsStatus:   WsConnectionStatus
 *   lastEvent:  CircuitBreakerEvent | null
 *
 * Dashboard.tsx feeds `liveAlerts` into the `nodes` useMemo so that only the
 * affected React Flow node changes status — all others are untouched.
 *
 * Architecture (read this before modifying):
 *
 *   kafka_listener.py (_watch_alerts)
 *         │  Kafka: transactions.alerts
 *         ▼
 *   state.py (set_circuit)
 *         │  ws broadcast: { channel: "circuit_breaker", event: { ... } }
 *         ▼
 *   websocketService.ts (connect / onCircuitBreaker)
 *         │  CircuitBreakerEvent (normalised, uppercase status)
 *         ▼
 *   useWebSocketAlerts (this hook)
 *         │  liveAlerts: LiveAlertMap
 *         ▼
 *   Dashboard.tsx nodes useMemo
 *         │  status override per node
 *         ▼
 *   PipelineNode (renders CRITICAL / red)
 *
 * Day 2: Wire this hook into Dashboard.tsx.
 * Day 3: Show a live-alert banner/toast when `lastEvent` changes.
 * Day 5: Add reconnection logic in websocketService.ts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CircuitBreakerEvent,
  CircuitBreakerNodeId,
  LiveAlertMap,
  LiveAlertState,
} from '../types/observability';
import {
  connect,
  disconnect,
  onCircuitBreaker,
  onSnapshot,
  onError,
  onClose,
  getStatus,
  WsConnectionStatus,
} from '../services/websocketService';
import { CIRCUIT_BREAKER_TO_NODE_STATUS } from '../data/circuitBreakerMapping';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocketAlerts() {
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertMap>({});
  const [wsStatus, setWsStatus]     = useState<WsConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent]   = useState<CircuitBreakerEvent | null>(null);

  // Snapshot received immediately on connection — carries current circuit state
  const [snapshotReceived, setSnapshotReceived] = useState(false);

  // Ref so cleanup callbacks always have the latest setters without re-registering
  const setLiveAlertsRef = useRef(setLiveAlerts);
  setLiveAlertsRef.current = setLiveAlerts;

  // ── Handler: circuit-breaker event ─────────────────────────────────────────
  const handleCircuitBreaker = useCallback((event: CircuitBreakerEvent) => {
    setLastEvent(event);

    setLiveAlertsRef.current(prev => {
      const next = { ...prev };

      if (event.status === 'CLOSED') {
        // CLOSED → remove the node from the alert map (returns to healthy)
        delete next[event.nodeId as CircuitBreakerNodeId];
      } else {
        const alertState: LiveAlertState = {
          nodeId:    event.nodeId,
          status:    event.status,
          severity:  event.severity,
          message:   event.message,
          timestamp: event.timestamp,
          errorRate: event.errorRate,
          active:    true,
        };
        next[event.nodeId as CircuitBreakerNodeId] = alertState;
      }

      return next;
    });
  }, []);

  // ── Handler: initial snapshot ───────────────────────────────────────────────
  const handleSnapshot = useCallback((snapshot: Record<string, unknown>) => {
    setSnapshotReceived(true);
    setWsStatus('connected');

    // Backend snapshot includes circuit_state: "open" | "closed" | "half_open"
    const rawState = (snapshot['circuit_state'] as string | undefined) ?? 'closed';

    // Import normaliser locally to avoid circular dep at module level
    import('../data/circuitBreakerMapping').then(({ normaliseCircuitBreakerState, CIRCUIT_BREAKER_TO_SEVERITY, CIRCUIT_BREAKER_LABELS }) => {
      const status = normaliseCircuitBreakerState(rawState);
      if (status !== 'CLOSED') {
        const syntheticEvent: CircuitBreakerEvent = {
          type:      'CIRCUIT_BREAKER',
          nodeId:    'process',
          status,
          severity:  CIRCUIT_BREAKER_TO_SEVERITY[status],
          message:   `[Snapshot] ${CIRCUIT_BREAKER_LABELS[status]}`,
          timestamp: new Date().toISOString(),
          errorRate: snapshot['error_rate'] as number | undefined,
        };
        handleCircuitBreaker(syntheticEvent);
      }
    });
  }, [handleCircuitBreaker]);

  // ── WebSocket lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    setWsStatus('connecting');
    connect();

    const unsubCb       = onCircuitBreaker(handleCircuitBreaker);
    const unsubSnap     = onSnapshot(handleSnapshot);
    const unsubErr      = onError(() => setWsStatus('error'));
    const unsubClose    = onClose(() => {
      setWsStatus('disconnected');
      setSnapshotReceived(false);
    });

    // Sync status from service on mount (in case connection is fast)
    setWsStatus(getStatus());

    return () => {
      unsubCb();
      unsubSnap();
      unsubErr();
      unsubClose();
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ intentionally empty — connect/disconnect once per component lifecycle

  // ── Derived helper: node status override ───────────────────────────────────
  /**
   * Returns the PipelineStatus that should be applied to a given node
   * based on the current live circuit-breaker state.
   * Returns `undefined` if no alert is active for that node (no override).
   */
  const getLiveStatusForNode = useCallback(
    (nodeId: string): 'healthy' | 'warning' | 'error' | 'offline' | undefined => {
      const alert = liveAlerts[nodeId as CircuitBreakerNodeId];
      if (!alert) return undefined;
      return CIRCUIT_BREAKER_TO_NODE_STATUS[alert.status];
    },
    [liveAlerts]
  );

  // ── Manual dismiss: clear a single node's alert ────────────────────────────
  const dismissLiveAlert = useCallback((nodeId: CircuitBreakerNodeId) => {
    setLiveAlerts(prev => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  return {
    /** Per-node live circuit-breaker states */
    liveAlerts,
    /** Overall WebSocket connection status */
    wsStatus,
    /** Most recently received circuit-breaker event (for banners / toasts) */
    lastEvent,
    /** true once the backend snapshot has been received */
    snapshotReceived,
    /** Returns the PipelineStatus override for a node, or undefined if healthy */
    getLiveStatusForNode,
    /** Manually dismiss a live alert for one node */
    dismissLiveAlert,
  };
}
