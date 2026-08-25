/**
 * IceStream — useObservability Hook
 *
 * Central observability state management. Drives:
 *   - Alert lifecycle (active → acknowledged → resolved)
 *   - Quarantine state
 *   - Automation steps
 *   - Pipeline operational state
 *   - 5-second polling loop (ready to swap to WebSocket)
 *   - Loading / error / retry states
 *
 * Architecture:
 *   React UI → useObservability → Service Layer → Mock / Real API
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ObservabilityState,
  ObservabilityAlert,
  DataQualityAnomaly,
  IncidentScenario,
  IncidentPreset,
  PipelineOperationalState,
  AutomationStep,
} from '../types/observability';
import {
  incidentPresets,
  healthyAutomationSteps,
  incidentAutomationSteps,
  warningAutomationSteps,
} from '../data/observabilityRules';

const POLL_INTERVAL_MS = 5000;

function nowTime(): string {
  return new Date().toTimeString().split(' ')[0];
}

function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateAnomalyId(): string {
  return `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildAlertFromPreset(preset: IncidentPreset): ObservabilityAlert {
  const ts = nowTime();
  const anomaly: DataQualityAnomaly = {
    id: generateAnomalyId(),
    nodeId: preset.affectedNodeId,
    ruleName: preset.label,
    metric: preset.metric,
    column: preset.column,
    expectedValue: preset.expectedValue,
    actualValue: preset.actualValue,
    threshold: preset.threshold,
    severity: preset.severity,
    status: 'active',
    detectedAt: ts,
    description: preset.anomalyDescription,
  };

  return {
    id: generateAlertId(),
    anomaly,
    createdAt: ts,
    updatedAt: ts,
  };
}

function derivePipelineState(
  scenario: IncidentScenario,
  quarantinedNodes: string[]
): PipelineOperationalState {
  if (quarantinedNodes.length > 0) return 'quarantined';
  if (scenario === 'healthy') return 'operational';
  if (scenario === 'high-null-rate' || scenario === 'schema-drift') return 'degraded';
  return 'degraded';
}

function deriveAutomationSteps(
  scenario: IncidentScenario,
  quarantinedNodes: string[]
): AutomationStep[] {
  if (scenario === 'healthy') return healthyAutomationSteps;
  if (quarantinedNodes.length > 0) return incidentAutomationSteps;
  return warningAutomationSteps;
}

const initialState: ObservabilityState = {
  pipelineState: 'operational',
  alerts: [],
  alertHistory: [],
  quarantinedNodes: [],
  automationSteps: healthyAutomationSteps,
  isLoading: false,
  error: null,
  lastPolled: nowTime(),
};

export function useObservability() {
  const [state, setState] = useState<ObservabilityState>(initialState);
  const [activeScenario, setActiveScenario] = useState<IncidentScenario>('healthy');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling tick ────────────────────────────────────────────────────────
  const poll = useCallback(() => {
    setState(prev => ({ ...prev, lastPolled: nowTime() }));
  }, []);

  useEffect(() => {
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [poll]);

  // ── Retry after error ───────────────────────────────────────────────────
  const retry = useCallback(() => {
    setState(prev => ({ ...prev, error: null, isLoading: false }));
  }, []);

  // ── Apply incident scenario ─────────────────────────────────────────────
  const applyScenario = useCallback((scenario: IncidentScenario) => {
    setActiveScenario(scenario);

    if (scenario === 'healthy') {
      setState(prev => ({
        ...prev,
        pipelineState: 'operational',
        // Move any active alerts to resolved in history
        alertHistory: [
          ...prev.alertHistory,
          ...prev.alerts
            .filter(a => a.anomaly.status === 'active')
            .map(a => ({
              ...a,
              anomaly: { ...a.anomaly, status: 'resolved' as const },
              resolvedAt: nowTime(),
              updatedAt: nowTime(),
            })),
        ],
        alerts: prev.alerts
          .filter(a => a.anomaly.status !== 'active')
          .map(a => ({
            ...a,
            anomaly: { ...a.anomaly, status: 'resolved' as const },
            resolvedAt: nowTime(),
            updatedAt: nowTime(),
          })),
        quarantinedNodes: [],
        automationSteps: healthyAutomationSteps,
        lastPolled: nowTime(),
      }));
      return;
    }

    const preset = incidentPresets[scenario];
    if (!preset) return;

    const newAlert = buildAlertFromPreset(preset);
    const quarantined = preset.severity === 'critical' ? [preset.affectedNodeId] : [];
    const pipelineState = derivePipelineState(scenario, quarantined);
    const automationSteps = deriveAutomationSteps(scenario, quarantined);

    setState(prev => ({
      ...prev,
      pipelineState,
      alerts: [newAlert, ...prev.alerts.filter(a => a.anomaly.status !== 'resolved')],
      alertHistory: [newAlert, ...prev.alertHistory],
      quarantinedNodes: quarantined,
      automationSteps,
      lastPolled: nowTime(),
    }));
  }, []);

  // ── Acknowledge alert ───────────────────────────────────────────────────
  const acknowledgeAlert = useCallback((alertId: string) => {
    const ts = nowTime();
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.map(a =>
        a.id === alertId
          ? {
              ...a,
              anomaly: { ...a.anomaly, status: 'acknowledged' as const },
              acknowledgedAt: ts,
              updatedAt: ts,
            }
          : a
      ),
      alertHistory: prev.alertHistory.map(a =>
        a.id === alertId
          ? {
              ...a,
              anomaly: { ...a.anomaly, status: 'acknowledged' as const },
              acknowledgedAt: ts,
              updatedAt: ts,
            }
          : a
      ),
    }));
  }, []);

  // ── Resolve alert ───────────────────────────────────────────────────────
  const resolveAlert = useCallback((alertId: string) => {
    const ts = nowTime();
    setState(prev => {
      const updatedAlerts = prev.alerts.map(a =>
        a.id === alertId
          ? {
              ...a,
              anomaly: { ...a.anomaly, status: 'resolved' as const },
              resolvedAt: ts,
              updatedAt: ts,
            }
          : a
      );
      const updatedHistory = prev.alertHistory.map(a =>
        a.id === alertId
          ? {
              ...a,
              anomaly: { ...a.anomaly, status: 'resolved' as const },
              resolvedAt: ts,
              updatedAt: ts,
            }
          : a
      );
      const stillActive = updatedAlerts.filter(a => a.anomaly.status === 'active').length;
      const newPipelineState: PipelineOperationalState =
        stillActive === 0 && prev.quarantinedNodes.length === 0
          ? 'operational'
          : prev.pipelineState;

      return {
        ...prev,
        alerts: updatedAlerts,
        alertHistory: updatedHistory,
        pipelineState: newPipelineState,
        updatedAt: ts,
      };
    });
  }, []);

  // ── Quarantine node manually ────────────────────────────────────────────
  const quarantineNode = useCallback((nodeId: string) => {
    setState(prev => ({
      ...prev,
      quarantinedNodes: prev.quarantinedNodes.includes(nodeId)
        ? prev.quarantinedNodes
        : [...prev.quarantinedNodes, nodeId],
      pipelineState: 'quarantined',
      automationSteps: incidentAutomationSteps,
    }));
  }, []);

  // ── Recover node from quarantine ────────────────────────────────────────
  const recoverNode = useCallback((nodeId: string) => {
    setState(prev => {
      const remaining = prev.quarantinedNodes.filter(n => n !== nodeId);
      return {
        ...prev,
        quarantinedNodes: remaining,
        pipelineState: remaining.length === 0 ? 'operational' : 'recovering',
        automationSteps:
          remaining.length === 0 ? healthyAutomationSteps : prev.automationSteps,
      };
    });
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────
  const activeAlerts = state.alerts.filter(
    a => a.anomaly.status === 'active' || a.anomaly.status === 'acknowledged'
  );
  const criticalAlerts = activeAlerts.filter(a => a.anomaly.severity === 'critical');
  const selectedAlert = state.alerts.find(a => a.id === selectedAlertId) ?? null;

  return {
    // State
    ...state,
    activeScenario,
    activeAlerts,
    criticalAlerts,
    selectedAlert,
    selectedAlertId,

    // Actions
    applyScenario,
    acknowledgeAlert,
    resolveAlert,
    quarantineNode,
    recoverNode,
    retry,
    setSelectedAlertId,
  };
}
