/**
 * IceStream — Main Dashboard (Day 3: Live WebSocket Alerts)
 *
 * Day 3 additions over Week 2:
 *   - Edge colors react to live WS circuit-breaker status (same priority as nodes)
 *   - Edge animation stops automatically when adjacent node is in error/warning
 *   - `liveAlerts` exposed from hook; all three nodes (ingest/process/serve) can
 *     independently turn red/amber from any circuit-breaker event
 *   - WsDevPanel (DEV mode only) — fire mock circuit-breaker events directly
 *     from the UI without opening DevTools
 *   - `getLiveStatusForNode` added to edges useMemo dependency array
 *
 * All Week 1/2 content is preserved: React Flow canvas, PipelineHeader,
 * StatusPanel, Legend, PipelineStats, IncidentSimulator, AlertPanel,
 * AlertHistory, AutomationStatus, PipelineHealthBanner, DetectionCheck.
 */

import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  EdgeTypes,
  MarkerType,
  BackgroundVariant,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PipelineNode } from '../components/PipelineNode';
import { FlowEdge } from '../components/FlowEdge';
import { PipelineHeader } from '../components/PipelineHeader';
import { PipelineStats } from '../components/PipelineStats';
import { StatusPanel } from '../components/StatusPanel';
import { Legend } from '../components/Legend';
import { IncidentSimulator } from '../components/IncidentSimulator';
import { AlertPanel } from '../components/AlertPanel';
import { AlertDetail } from '../components/AlertDetail';
import { AlertHistory } from '../components/AlertHistory';
import { AutomationStatus } from '../components/AutomationStatus';
import { PipelineHealthBanner } from '../components/PipelineHealthBanner';
import { DetectionCheck } from '../components/DetectionCheck';
import { WsDevPanel } from '../components/WsDevPanel';
import { IncidentLog } from '../components/IncidentLog';
import { SelfHealingPanel } from '../components/SelfHealingPanel';

import { usePipelineSimulation } from '../hooks/usePipelineSimulation';
import { useObservability } from '../hooks/useObservability';
import { useWebSocketAlerts } from '../hooks/useWebSocketAlerts';
import { useIncidentLog } from '../hooks/useIncidentLog';
import { useSelfHealing } from '../hooks/useSelfHealing';
import { useTheme } from '../context/ThemeContext';
import { PipelineNodeData } from '../types/pipeline';
import { IncidentScenario } from '../types/observability';
import { SimulationScenario } from '../hooks/usePipelineSimulation';
import { LiveAlertBanner } from '../components/LiveAlertBanner';
import { Layers } from 'lucide-react';


const nodeTypes = {
  pipelineNode: PipelineNode,
};

const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
};

export const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ── Week 1 pipeline simulation hook (preserving all original functionality) ──
  const {
    stages,
    summary,
    selectedStageId,
    selectedStage,
    setSelectedStageId,
    isLive,
    toggleLive,
    manualRefresh,
    activeScenario: simScenario,
    setScenario,
    resetStages,
  } = usePipelineSimulation();

  // ── Week 2 observability hook ──────────────────────────────────────────────
  const obs = useObservability();

  // ── Day 3: Live WebSocket circuit-breaker alerts ───────────────────────────
  // liveAlerts: map of nodeId → LiveAlertState for every active circuit trip
  // justChangedNodes: set of nodeIds that just transitioned — triggers flash ring
  // getLiveStatusForNode: returns the WS-driven status override or undefined
  const {
    wsStatus,
    liveAlerts,
    lastEvent: liveEvent,
    getLiveStatusForNode,
    dismissLiveAlert,
    justChangedNodes,
  } = useWebSocketAlerts();

  // ── Incident log — tracks all pause/resume events from WS + scenarios ────────
  const incidentLog = useIncidentLog();

  // Forward every live circuit-breaker WS event into the incident log so it
  // captures real backend events (OPEN → HALF_OPEN → CLOSED) in addition to
  // simulated scenario injections.
  React.useEffect(() => {
    if (liveEvent) {
      incidentLog.handleCircuitBreakerEvent(liveEvent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent]);

  // ── Self-Healing engine ─────────────────────────────────────────────────────
  // Receives live pipeline state and circuit-breaker events; evaluates policies
  // autonomously and exposes manual trigger actions to the SelfHealingPanel.
  const healing = useSelfHealing({
    stages,
    circuitState: wsStatus === 'connected'
      ? (Object.values(liveAlerts).some(a => a?.status === 'OPEN') ? 'open'
         : Object.values(liveAlerts).some(a => a?.status === 'HALF_OPEN') ? 'half_open'
         : 'closed')
      : 'closed',
    errorRate: stages.find(s => s.id === 'process')?.errorRatePct
      ? (stages.find(s => s.id === 'process')!.errorRatePct! / 100)
      : (liveEvent?.errorRate ?? 0),
    activeScenario: obs.activeScenario,
    liveEvent,
  });

  const handleSelectScenario = useCallback(
    (incidentScenario: IncidentScenario, simSc: SimulationScenario) => {
      setScenario(simSc);
      obs.applyScenario(incidentScenario);
      incidentLog.applyScenarioIncident(incidentScenario);
    },
    [setScenario, obs.applyScenario, incidentLog.applyScenarioIncident]
  );

  // When the existing header scenario selector changes (Week 1 selector)
  const handleHeaderScenario = useCallback(
    (scenario: SimulationScenario) => {
      setScenario(scenario);
      if (scenario === 'healthy') {
        obs.applyScenario('healthy');
        incidentLog.applyScenarioIncident('healthy');
      } else if (scenario === 'flink-backpressure') {
        obs.applyScenario('high-latency');
        incidentLog.applyScenarioIncident('high-latency');
      }
    },
    [setScenario, obs.applyScenario, incidentLog.applyScenarioIncident]
  );

  // ── ReactFlow nodes — priority: quarantine > live WS alert > sim scenario ─
  const nodes: Node<PipelineNodeData>[] = useMemo(() => {
    return stages.map((stage, idx) => {
      const xPos = 40 + idx * 480;
      const yPos = 80;

      const isQuarantined = obs.quarantinedNodes.includes(stage.id);
      const liveStatus    = getLiveStatusForNode(stage.id);

      // Priority: quarantine (fuchsia) > live WS CRITICAL/WARNING > scenario status
      const resolvedStatus = isQuarantined
        ? ('quarantined' as const)
        : liveStatus ?? stage.status;

      // liveAlert: true when this node is currently in justChangedNodes
      // → PipelineNode uses it to play the flash ring animation
      const liveAlert = justChangedNodes.has(stage.id);

      return {
        id: stage.id,
        type: 'pipelineNode',
        position: { x: xPos, y: yPos },
        data: {
          ...stage,
          status: resolvedStatus as PipelineNodeData['status'],
          liveAlert,
        },
        selected: selectedStageId === stage.id,
      };
    });
  }, [stages, selectedStageId, obs.quarantinedNodes, getLiveStatusForNode, justChangedNodes]);


  // ── ReactFlow edges — live-status-aware color + animation ─────────────────
  //
  // Day 3 change: edges now resolve each stage's *effective* status using the
  // same priority chain as the nodes (quarantine > live WS > sim scenario).
  // Previously the edge color only reflected simulation stage.status, so a WS
  // circuit-breaker OPEN event would turn the node red but leave the wire blue.
  const edges: Edge[] = useMemo(() => {
    const ingestStage  = stages.find(s => s.id === 'ingest');
    const processStage = stages.find(s => s.id === 'process');
    const serveStage   = stages.find(s => s.id === 'serve');
    const processQuarantined = obs.quarantinedNodes.includes('process');

    // Resolve the effective display status for each stage
    const resolveEdgeStatus = (stage: typeof ingestStage) => {
      if (!stage) return 'healthy';
      if (obs.quarantinedNodes.includes(stage.id)) return 'quarantined';
      return getLiveStatusForNode(stage.id) ?? stage.status;
    };

    const ingestStatus  = resolveEdgeStatus(ingestStage);
    const processStatus = resolveEdgeStatus(processStage);
    const serveStatus   = resolveEdgeStatus(serveStage);

    const getEdgeColor = (srcStatus: string, tgtStatus: string): string => {
      if (srcStatus === 'quarantined' || tgtStatus === 'quarantined')
        return isDark ? '#d946ef' : '#a21caf'; // fuchsia for quarantine
      if (srcStatus === 'error' || tgtStatus === 'error')
        return isDark ? '#f43f5e' : '#e11d48';  // red for circuit OPEN / critical
      if (srcStatus === 'warning' || tgtStatus === 'warning')
        return isDark ? '#f59e0b' : '#d97706';  // amber for half-open / warning
      return isDark ? '#38bdf8' : '#0284c7';     // sky-blue for healthy
    };

    const ingestProcessColor = getEdgeColor(ingestStatus, processStatus);
    const processServeColor  = processQuarantined
      ? (isDark ? '#f43f5e' : '#e11d48')
      : getEdgeColor(processStatus, serveStatus);

    // Stop the animated dash when either endpoint is unhealthy (broken flow)
    const ingestProcessAnimated =
      isLive && !processQuarantined &&
      ingestStatus === 'healthy' && processStatus === 'healthy';
    const processServeAnimated =
      isLive && !processQuarantined &&
      processStatus === 'healthy' && serveStatus === 'healthy';

    return [
      {
        id: 'e-ingest-process',
        source: 'ingest',
        target: 'process',
        animated: ingestProcessAnimated,
        type: 'flowEdge',
        data: {
          label: 'Raw Stream (Avro / JSON)',
          blocked: false,
          isDark,
        },
        style: { stroke: ingestProcessColor, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: ingestProcessColor, width: 18, height: 18 },
      },
      {
        id: 'e-process-serve',
        source: 'process',
        target: 'serve',
        animated: processServeAnimated,
        type: 'flowEdge',
        data: {
          label: processQuarantined ? 'BLOCKED — Quarantined' : 'Data Quality & Clean Parquet',
          blocked: processQuarantined,
          isDark,
        },
        style: {
          stroke: processServeColor,
          strokeWidth: processQuarantined ? 2 : 2.5,
          strokeDasharray: processQuarantined ? '8 4' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: processServeColor, width: 18, height: 18 },
      },
    ];
  }, [stages, isLive, isDark, obs.quarantinedNodes, getLiveStatusForNode]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedStageId(node.id as any);
  }, [setSelectedStageId]);

  const onPaneClick = useCallback(() => {
    setSelectedStageId(null);
  }, [setSelectedStageId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* ── Top Header (Week 1 — preserved) ── */}
      <PipelineHeader
        systemStatus={summary.systemStatus}
        lastUpdated={summary.lastUpdated}
        isLive={isLive}
        onToggleLive={toggleLive}
        onRefresh={manualRefresh}
        activeScenario={simScenario}
        onSelectScenario={handleHeaderScenario}
        onReset={() => { resetStages(); obs.applyScenario('healthy'); incidentLog.applyScenarioIncident('healthy'); }}
        wsStatus={wsStatus}
      />


      {/* ── Main Dashboard Body ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">

        {/* ── KPI Metrics Banner (extended with 2 new cards) ── */}
        <PipelineStats
          summary={summary}
          criticalAlertCount={obs.criticalAlerts.length}
          quarantinedNodeCount={obs.quarantinedNodes.length}
        />

        {/* ── Live WebSocket Alert Banner — shows on real circuit-breaker events ── */}
        <LiveAlertBanner
          event={liveEvent}
          onDismiss={() => liveEvent && dismissLiveAlert(liveEvent.nodeId)}
        />

        {/* ── Pipeline Health Banner (Week 2) ── */}

        <PipelineHealthBanner
          pipelineState={obs.pipelineState}
          quarantinedNodes={obs.quarantinedNodes}
          lastPolled={obs.lastPolled}
          isLoading={obs.isLoading}
          error={obs.error}
          onRetry={obs.retry}
        />

        {/* ── Incident Simulator (Week 2) ── */}
        <IncidentSimulator
          activeScenario={obs.activeScenario}
          onSelectScenario={handleSelectScenario}
        />

        {/* ── Detection Check — fires immediately on bad-data injection ── */}
        <DetectionCheck
          event={obs.detectionEvent}
          onDismiss={obs.dismissDetection}
        />

        {/* ── Lineage Graph Section ── */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl backdrop-blur-md flex flex-col gap-3 transition-colors">

          {/* Canvas Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 px-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                  DATA LINEAGE ARCHITECTURE
                  <span className="text-[10px] font-mono font-normal text-slate-500 dark:text-slate-400">
                    (Interactive React Flow Canvas)
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  E-Commerce Generator → INGEST (Kafka) → PROCESS (Flink) → SERVE (Iceberg)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-ping" />
              <span>Select any stage to inspect real-time metrics &amp; metadata</span>
            </div>
          </div>

          {/* React Flow Viewport Container */}
          <div className="h-[430px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-950 relative transition-colors">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.5}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.5}
                color={isDark ? '#334155' : '#cbd5e1'}
                style={{ border: 'none', outline: 'none' }}
              />
              <Controls className="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-800 !text-slate-700 dark:!text-slate-300 !fill-slate-700 dark:!fill-slate-300" />
              <MiniMap
                nodeColor={(n) => {
                  if (n.data?.status === 'quarantined') return '#d946ef';
                  if (n.data?.status === 'error' || n.data?.status === 'critical') return '#ef4444';
                  if (n.data?.status === 'warning') return '#f59e0b';
                  return '#0ea5e9';
                }}
                maskColor={isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(241, 245, 249, 0.75)'}
                position="top-right"
                style={{ width: 120, height: 80 }}
                className="!bg-white/90 dark:!bg-slate-900/90 !border-slate-200 dark:!border-slate-800 !rounded-lg overflow-hidden !shadow-md dark:!shadow-lg hidden md:block"
              />
            </ReactFlow>

            {/* Ingress Tag */}
            <div className="absolute top-3 left-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
              Source: E-Commerce Transaction Stream
            </div>

            {/* Egress Tag */}
            <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Sink: Lakehouse Table Storage &amp; Analytics
            </div>

            {/* Live alert overlay — compact chips for each active breaker */}
            {Object.keys(liveAlerts).length > 0 && (
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 pointer-events-none mr-[132px]">
                {(Object.entries(liveAlerts) as [string, NonNullable<typeof liveAlerts[keyof typeof liveAlerts]>][]).map(
                  ([nodeId, alert]) => (
                    <div
                      key={nodeId}
                      className={`flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border shadow-sm backdrop-blur-sm
                        ${alert.status === 'OPEN'
                          ? 'bg-rose-50/90 dark:bg-rose-950/80 border-rose-400/60 dark:border-rose-500/50 text-rose-700 dark:text-rose-300'
                          : alert.status === 'HALF_OPEN'
                          ? 'bg-amber-50/90 dark:bg-amber-950/80 border-amber-400/60 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-50/90 dark:bg-emerald-950/80 border-emerald-400/60 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                        }`}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse
                        ${alert.status === 'OPEN' ? 'bg-rose-500' : alert.status === 'HALF_OPEN' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      />
                      ⚡ {nodeId.toUpperCase()} {alert.status}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Selected Stage Detail Drawer (Week 1 — preserved) ── */}
        {selectedStage && (
          <StatusPanel
            selectedStage={selectedStage}
            onClose={() => setSelectedStageId(null)}
          />
        )}

        {/* ── Week 2 Observability Panels ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alert Panel */}
          <AlertPanel
            alerts={obs.activeAlerts}
            onViewDetails={obs.setSelectedAlertId}
            onAcknowledge={obs.acknowledgeAlert}
          />

          {/* Automation Status */}
          <AutomationStatus
            steps={obs.automationSteps}
            pipelineState={obs.pipelineState}
          />
        </div>

        {/* ── Alert History ── */}
        <AlertHistory
          history={obs.alertHistory}
          onViewDetails={obs.setSelectedAlertId}
        />

        {/* ── Incident Log — detailed pipeline pause/resume timeline ── */}
        <IncidentLog
          incidents={incidentLog.incidents}
          openCount={incidentLog.openCount}
          recoverCount={incidentLog.recoverCount}
          resolvedCount={incidentLog.resolvedCount}
          onDismiss={incidentLog.dismissIncident}
          onClearDismissed={incidentLog.clearDismissed}
        />

        {/* ── Self-Healing Pipeline Panel ─────────────────────────────────────
            Proactive data quality engineering: health score, policy engine,
            DLQ retry queue, schema coercion, backpressure relief, audit log.
        ── */}
        <SelfHealingPanel
          enabled={healing.enabled}
          mode={healing.mode}
          actions={healing.actions}
          policies={healing.policies}
          healthScore={healing.healthScore}
          dlqRecords={healing.dlqRecords}
          lastProbe={healing.lastProbe}
          totalAutoResolved={healing.totalAutoResolved}
          totalManualResolved={healing.totalManualResolved}
          pendingDLQ={healing.pendingDLQ}
          runningCount={healing.runningCount}
          onCircuitProbe={healing.manualCircuitProbe}
          onDLQRetry={healing.manualDLQRetry}
          onSchemaCoerce={healing.manualSchemaCoerce}
          onBackpressure={healing.manualBackpressure}
          onThroughputBoost={healing.manualThroughputBoost}
          onHealthProbe={healing.manualHealthProbe}
          onToggleEnabled={healing.toggleEnabled}
          onSetMode={healing.setHealingMode}
          onUpdatePolicy={healing.updatePolicy}
          onDismissDLQ={healing.dismissDLQRecord}
          onClearSucceeded={healing.clearSucceededActions}
        />

        {/* ── Status Legend (Week 1 — preserved) ── */}
        <Legend />

        {/* ── DEV-only: WS mock event panel ─────────────────────────────────────
            Renders only in Vite DEV mode. Lets you test the full circuit-breaker
            → node-red → edge-red → banner pipeline without a running backend.
        ── */}
        {import.meta.env.DEV && <WsDevPanel />}

      </main>

      {/* ── Alert Detail Modal (Week 2) ── */}
      {obs.selectedAlert && (
        <AlertDetail
          alert={obs.selectedAlert}
          onClose={() => obs.setSelectedAlertId(null)}
          onAcknowledge={obs.acknowledgeAlert}
          onResolve={obs.resolveAlert}
        />
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 py-4 px-4 text-center text-xs font-mono text-slate-500 dark:text-slate-400 mt-auto transition-colors">
        <p>
          IceStream Real-Time Lakehouse Observability • Self-Healing Pipeline — Proactive Data Quality Engineering
        </p>
      </footer>
    </div>
  );
};

