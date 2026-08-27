/**
 * IceStream — Main Dashboard (Week 2 — Observability Extension)
 *
 * Extends the Week 1 React Flow dashboard with:
 *   - IncidentSimulator (5 scenarios)
 *   - PipelineHealthBanner (OPERATIONAL/DEGRADED/QUARANTINED)
 *   - AlertPanel (active + acknowledged alerts)
 *   - AlertDetail modal
 *   - AlertHistory table with filters
 *   - AutomationStatus panel
 *   - Quarantine edge rendering (blocked X on process→serve)
 *   - Extended KPI cards (Critical Alerts + Quarantined Nodes)
 *
 * All Week 1 content is preserved: React Flow canvas, PipelineHeader,
 * StatusPanel, Legend, PipelineStats cards 1-4.
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

import { usePipelineSimulation } from '../hooks/usePipelineSimulation';
import { useObservability } from '../hooks/useObservability';
import { useTheme } from '../context/ThemeContext';
import { PipelineNodeData } from '../types/pipeline';
import { IncidentScenario } from '../types/observability';
import { SimulationScenario } from '../hooks/usePipelineSimulation';
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

  // ── Unified scenario handler: updates both hooks atomically ───────────────
  const handleSelectScenario = useCallback(
    (incidentScenario: IncidentScenario, simSc: SimulationScenario) => {
      setScenario(simSc);
      obs.applyScenario(incidentScenario);
    },
    [setScenario, obs.applyScenario]
  );

  // When the existing header scenario selector changes (Week 1 selector)
  const handleHeaderScenario = useCallback(
    (scenario: SimulationScenario) => {
      setScenario(scenario);
      // Map Week 1 scenarios to observability scenarios
      if (scenario === 'healthy') obs.applyScenario('healthy');
      else if (scenario === 'flink-backpressure') obs.applyScenario('high-latency');
      // Other Week 1 scenarios don't have a direct observability mapping — just run them
    },
    [setScenario, obs.applyScenario]
  );

  // ── ReactFlow nodes — mark quarantined nodes from obs state ───────────────
  const nodes: Node<PipelineNodeData>[] = useMemo(() => {
    return stages.map((stage, idx) => {
      const xPos = 40 + idx * 480;
      const yPos = 80;

      const isQuarantined = obs.quarantinedNodes.includes(stage.id);

      return {
        id: stage.id,
        type: 'pipelineNode',
        position: { x: xPos, y: yPos },
        data: {
          ...stage,
          // Override status for quarantined nodes so PipelineNode renders QUARANTINED
          status: isQuarantined ? ('quarantined' as any) : stage.status,
        },
        selected: selectedStageId === stage.id,
      };
    });
  }, [stages, selectedStageId, obs.quarantinedNodes]);

  // ── ReactFlow edges — broken edge when PROCESS is quarantined ────────────
  const edges: Edge[] = useMemo(() => {
    const ingestStage = stages.find(s => s.id === 'ingest');
    const processStage = stages.find(s => s.id === 'process');
    const serveStage = stages.find(s => s.id === 'serve');
    const processQuarantined = obs.quarantinedNodes.includes('process');

    const getEdgeColor = (sourceStatus?: string, targetStatus?: string) => {
      if (processQuarantined && (sourceStatus === 'process' || targetStatus === 'process'))
        return isDark ? '#d946ef' : '#a21caf'; // fuchsia for quarantine
      if (sourceStatus === 'error' || targetStatus === 'error') return isDark ? '#f43f5e' : '#e11d48';
      if (sourceStatus === 'warning' || targetStatus === 'warning') return isDark ? '#f59e0b' : '#d97706';
      return isDark ? '#38bdf8' : '#0284c7';
    };

    const ingestProcessColor = getEdgeColor(ingestStage?.status, processStage?.status);
    const processServeColor = processQuarantined
      ? isDark ? '#f43f5e' : '#e11d48'
      : getEdgeColor(processStage?.status, serveStage?.status);




    return [
      {
        id: 'e-ingest-process',
        source: 'ingest',
        target: 'process',
        animated: isLive && !processQuarantined,
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
        animated: isLive && !processQuarantined,
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
  }, [stages, isLive, isDark, obs.quarantinedNodes]);

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
        onReset={() => { resetStages(); obs.applyScenario('healthy'); }}
      />

      {/* ── Main Dashboard Body ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">

        {/* ── KPI Metrics Banner (extended with 2 new cards) ── */}
        <PipelineStats
          summary={summary}
          criticalAlertCount={obs.criticalAlerts.length}
          quarantinedNodeCount={obs.quarantinedNodes.length}
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

        {/* ── Lineage Graph Section (Week 1 — preserved) ── */}
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

        {/* ── Status Legend (Week 1 — preserved) ── */}
        <Legend />

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
          IceStream Real-Time Lakehouse Observability • Member 2 Week 2 — Observability Dashboard
        </p>
      </footer>
    </div>
  );
};
