import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  BackgroundVariant,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { PipelineNode } from '../components/PipelineNode';
import { PipelineHeader } from '../components/PipelineHeader';
import { PipelineStats } from '../components/PipelineStats';
import { StatusPanel } from '../components/StatusPanel';
import { Legend } from '../components/Legend';
import { usePipelineSimulation } from '../hooks/usePipelineSimulation';
import { PipelineNodeData } from '../types/pipeline';
import { Layers } from 'lucide-react';

const nodeTypes = {
  pipelineNode: PipelineNode,
};

export const Dashboard: React.FC = () => {
  const {
    stages,
    summary,
    selectedStageId,
    selectedStage,
    setSelectedStageId,
    isLive,
    toggleLive,
    manualRefresh,
    activeScenario,
    setScenario,
    resetStages,
  } = usePipelineSimulation();

  // Define layout positions for the horizontal lineage graph
  const nodes: Node<PipelineNodeData>[] = useMemo(() => {
    return stages.map((stage, idx) => {
      // Horizontal spacing
      const xPos = 40 + idx * 360;
      const yPos = 120;

      return {
        id: stage.id,
        type: 'pipelineNode',
        position: { x: xPos, y: yPos },
        data: stage,
        selected: selectedStageId === stage.id,
      };
    });
  }, [stages, selectedStageId]);

  // Edges connecting INGEST -> PROCESS -> SERVE with smooth animation
  const edges: Edge[] = useMemo(() => {
    const ingestStage = stages.find(s => s.id === 'ingest');
    const processStage = stages.find(s => s.id === 'process');
    const serveStage = stages.find(s => s.id === 'serve');

    const getEdgeColor = (sourceStatus?: string, targetStatus?: string) => {
      if (sourceStatus === 'error' || targetStatus === 'error') return '#f43f5e';
      if (sourceStatus === 'warning' || targetStatus === 'warning') return '#f59e0b';
      return '#38bdf8';
    };

    return [
      {
        id: 'e-ingest-process',
        source: 'ingest',
        target: 'process',
        animated: isLive,
        type: 'smoothstep',
        label: 'Raw Stream (Avro / JSON)',
        labelStyle: {
          fill: '#94a3b8',
          fontWeight: 600,
          fontSize: 11,
          fontFamily: 'monospace',
        },
        labelBgStyle: {
          fill: '#0f172a',
          fillOpacity: 0.9,
          stroke: '#334155',
          strokeWidth: 1,
          rx: 6,
          ry: 6,
        },
        labelBgPadding: [8, 4] as [number, number],
        style: {
          stroke: getEdgeColor(ingestStage?.status, processStage?.status),
          strokeWidth: 2.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: getEdgeColor(ingestStage?.status, processStage?.status),
          width: 18,
          height: 18,
        },
      },
      {
        id: 'e-process-serve',
        source: 'process',
        target: 'serve',
        animated: isLive,
        type: 'smoothstep',
        label: 'Data Quality & Clean Parquet',
        labelStyle: {
          fill: '#94a3b8',
          fontWeight: 600,
          fontSize: 11,
          fontFamily: 'monospace',
        },
        labelBgStyle: {
          fill: '#0f172a',
          fillOpacity: 0.9,
          stroke: '#334155',
          strokeWidth: 1,
          rx: 6,
          ry: 6,
        },
        labelBgPadding: [8, 4] as [number, number],
        style: {
          stroke: getEdgeColor(processStage?.status, serveStage?.status),
          strokeWidth: 2.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: getEdgeColor(processStage?.status, serveStage?.status),
          width: 18,
          height: 18,
        },
      },
    ];
  }, [stages, isLive]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedStageId(node.id as any);
  }, [setSelectedStageId]);

  const onPaneClick = useCallback(() => {
    setSelectedStageId(null);
  }, [setSelectedStageId]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <PipelineHeader
        systemStatus={summary.systemStatus}
        lastUpdated={summary.lastUpdated}
        isLive={isLive}
        onToggleLive={toggleLive}
        onRefresh={manualRefresh}
        activeScenario={activeScenario}
        onSelectScenario={setScenario}
        onReset={resetStages}
      />

      {/* Main Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
        
        {/* KPI Metrics Banner */}
        <PipelineStats summary={summary} />

        {/* Lineage Graph Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col gap-3">
          
          {/* Canvas Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800 px-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                  DATA LINEAGE ARCHITECTURE
                  <span className="text-[10px] font-mono font-normal text-slate-400">
                    (Interactive React Flow Canvas)
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  E-Commerce Generator → INGEST (Kafka) → PROCESS (Flink) → SERVE (Iceberg)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span>Select any stage to inspect real-time metrics & metadata</span>
            </div>
          </div>

          {/* React Flow Viewport Container */}
          <div className="h-[430px] w-full rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.5}
              maxZoom={1.5}
              defaultEdgeOptions={{ type: 'smoothstep' }}
              proOptions={{ hideAttribution: true }}
            >
              {/* Background Dots Pattern */}
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.5}
                color="#334155"
              />

              {/* Canvas Controls */}
              <Controls className="!bg-slate-900 !border-slate-800 !text-slate-300 !fill-slate-300 [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!fill-slate-300 [&>button:hover]:!bg-slate-800" />

              {/* Minimap */}
              <MiniMap
                nodeColor={(n) => {
                  if (n.data?.status === 'error') return '#ef4444';
                  if (n.data?.status === 'warning') return '#f59e0b';
                  return '#0ea5e9';
                }}
                maskColor="rgba(15, 23, 42, 0.75)"
                className="!bg-slate-900/90 !border-slate-800 !rounded-lg overflow-hidden !shadow-lg hidden md:block"
              />
            </ReactFlow>

            {/* Ingress Stream Tag badge */}
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-800 text-slate-300 text-[11px] font-mono px-2.5 py-1 rounded-md shadow flex items-center gap-1.5 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Source: E-Commerce Transaction Stream
            </div>

            {/* Egress Lakehouse Analytics Tag badge */}
            <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur border border-slate-800 text-slate-300 text-[11px] font-mono px-2.5 py-1 rounded-md shadow flex items-center gap-1.5 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Sink: Lakehouse Table Storage & Analytics
            </div>
          </div>
        </div>

        {/* Selected Stage Detail Drawer / Panel */}
        {selectedStage && (
          <StatusPanel
            selectedStage={selectedStage}
            onClose={() => setSelectedStageId(null)}
          />
        )}

        {/* Status Legend */}
        <Legend />

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-4 text-center text-xs font-mono text-slate-400 mt-auto">
        <p>
          IceStream Real-Time Lakehouse Observability • Member 2 Week 1 UI Deliverable
        </p>
      </footer>
    </div>
  );
};
