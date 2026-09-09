/**
 * IceStream — useWebSocketAlerts Hook  (Day 3: instant node state changes)
 *
 * Owns all live circuit-breaker state driven by the WebSocket feed.
 *
 * Day 3 changes vs Day 1/2:
 *   - Uses onStatusChange() push feed instead of setWsStatus inside onClose/onError
 *     callbacks → wsStatus updates in the same microtask as the WS event,
 *     not a render later.
 *   - Snapshot handler is now synchronous (no dynamic import).
 *   - Exposes `justChangedNodes: Set<string>` — nodes that changed state in the
 *     last 1 second.  PipelineNode uses this to play a flash animation so the
 *     user sees the state change immediately.
 *   - handleCircuitBreaker fires setLiveAlerts as a direct state update
 *     (functional form) so React batches nothing and re-renders in the same frame.
 *
 * Architecture:
 *   kafka_listener.py (_watch_alerts)
 *         │  Kafka: transactions.alerts
 *         ▼
 *   state.py (set_circuit) → websocket_manager.broadcast()
 *         │  { channel: "circuit_breaker", event: { to_state: "open", ... } }
 *         ▼
 *   websocketService.ts  onCircuitBreaker listener
 *         │  CircuitBreakerEvent (normalised, uppercase status)
 *         ▼
 *   useWebSocketAlerts (this hook)
 *         │  liveAlerts: LiveAlertMap
 *         │  justChangedNodes: Set<string>
 *         ▼
 *   Dashboard.tsx  nodes useMemo → status override
 *         ▼
 *   PipelineNode  → flash animation + new status colour  (instant)
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
  onStatusChange,
  WsConnectionStatus,
} from '../services/websocketService';
import {
  CIRCUIT_BREAKER_TO_NODE_STATUS,
  normaliseCircuitBreakerState,
  CIRCUIT_BREAKER_TO_SEVERITY,
  CIRCUIT_BREAKER_LABELS,
} from '../data/circuitBreakerMapping';

// How long a node stays in the "just changed" set (flash duration)
const FLASH_DURATION_MS = 1_200;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocketAlerts() {
  const [liveAlerts,     setLiveAlerts]     = useState<LiveAlertMap>({});
  const [wsStatus,       setWsStatus]       = useState<WsConnectionStatus>('disconnected');
  const [lastEvent,      setLastEvent]      = useState<CircuitBreakerEvent | null>(null);
  const [snapshotReceived, setSnapshotReceived] = useState(false);

  /**
   * Set of nodeIds that changed state in the last FLASH_DURATION_MS.
   * Triggers the flash animation in PipelineNode.
   */
  const [justChangedNodes, setJustChangedNodes] = useState<Set<string>>(new Set());

  // Keep flash-timers so we can clear them on unmount
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Flash helper ─────────────────────────────────────────────────────────────
  const flashNode = useCallback((nodeId: string) => {
    // Clear existing timer for this node before starting a new one
    const existing = flashTimers.current.get(nodeId);
    if (existing) clearTimeout(existing);

    setJustChangedNodes(prev => new Set([...prev, nodeId]));

    const timer = setTimeout(() => {
      flashTimers.current.delete(nodeId);
      setJustChangedNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }, FLASH_DURATION_MS);

    flashTimers.current.set(nodeId, timer);
  }, []);

  // ── Handler: circuit-breaker event ──────────────────────────────────────────
  const handleCircuitBreaker = useCallback((event: CircuitBreakerEvent) => {
    // Update lastEvent — triggers LiveAlertBanner
    setLastEvent(event);

    // Update liveAlerts map — triggers nodes useMemo in Dashboard
    setLiveAlerts(prev => {
      const next = { ...prev };
      if (event.status === 'CLOSED') {
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

    // Trigger flash animation on the affected node
    flashNode(event.nodeId);
  }, [flashNode]);

  // ── Handler: initial snapshot ────────────────────────────────────────────────
  // Synchronous — no dynamic import — so it fires in the same call stack as
  // onopen → snapshot message → _dispatch → this handler.
  const handleSnapshot = useCallback((snapshot: Record<string, unknown>) => {
    setSnapshotReceived(true);

    const rawState = (snapshot['circuit_state'] as string | undefined) ?? 'closed';
    const status   = normaliseCircuitBreakerState(rawState);

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
  }, [handleCircuitBreaker]);

  // ── WebSocket lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    // onStatusChange fires immediately with current status on subscribe,
    // then on every subsequent change → wsStatus is always in sync.
    const unsubStatus = onStatusChange(setWsStatus);
    const unsubCb     = onCircuitBreaker(handleCircuitBreaker);
    const unsubSnap   = onSnapshot(handleSnapshot);

    connect();

    return () => {
      unsubStatus();
      unsubCb();
      unsubSnap();
      disconnect();

      // Clear all pending flash timers
      flashTimers.current.forEach(t => clearTimeout(t));
      flashTimers.current.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived: node status override ───────────────────────────────────────────
  /**
   * Returns the PipelineStatus to apply to a given node based on live WS state.
   * Returns undefined if the node has no active circuit-breaker alert.
   */
  const getLiveStatusForNode = useCallback(
    (nodeId: string): 'healthy' | 'warning' | 'error' | 'offline' | undefined => {
      const alert = liveAlerts[nodeId as CircuitBreakerNodeId];
      if (!alert) return undefined;
      return CIRCUIT_BREAKER_TO_NODE_STATUS[alert.status];
    },
    [liveAlerts]
  );

  // ── Manual dismiss ───────────────────────────────────────────────────────────
  const dismissLiveAlert = useCallback((nodeId: CircuitBreakerNodeId) => {
    setLiveAlerts(prev => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);

  return {
    /** Per-node circuit-breaker states */
    liveAlerts,
    /** Live WebSocket connection status — updates in the same microtask as WS events */
    wsStatus,
    /** Most recently received circuit-breaker event */
    lastEvent,
    /** true once the backend snapshot has been received after connect */
    snapshotReceived,
    /** Nodes that changed state in the last ~1 s — used to trigger flash animation */
    justChangedNodes,
    /** Returns the PipelineStatus override for a node, or undefined if no override */
    getLiveStatusForNode,
    /** Manually dismiss a live alert for one node (does not affect WebSocket state) */
    dismissLiveAlert,
  };
}
