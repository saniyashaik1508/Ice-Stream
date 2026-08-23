import React from 'react';
import { PipelineNodeData } from '../types/pipeline';
import { getStatusConfig } from './PipelineNode';
import { 
  X, 
  Layers, 
  Activity, 
  Clock, 
  Radio, 
  Cpu, 
  Database, 
  Code
} from 'lucide-react';

interface StatusPanelProps {
  selectedStage: PipelineNodeData | null;
  onClose: () => void;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ selectedStage, onClose }) => {
  if (!selectedStage) return null;

  const statusCfg = getStatusConfig(selectedStage.status);

  const getStageIcon = (id: string) => {
    switch (id) {
      case 'ingest':
        return Radio;
      case 'process':
        return Cpu;
      case 'serve':
        return Database;
      default:
        return Layers;
    }
  };

  const StageIcon = getStageIcon(selectedStage.id);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg dark:shadow-2xl backdrop-blur-md flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200 transition-colors">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-700/60 shadow-xs">
            <StageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase">
                Stage Detail
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
                {selectedStage.label}
              </h2>
            </div>
            <p className="text-xs text-sky-600 dark:text-sky-400 font-mono mt-0.5 font-medium">
              {selectedStage.technology}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Close details panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status & Quick Stats Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status:</span>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold ${statusCfg.bgPill}`}>
            <span className={`w-2 h-2 rounded-full ${statusCfg.dotColor} animate-pulse`} />
            <span>{statusCfg.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Activity className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span className="font-bold">{selectedStage.eventsPerSecond.toLocaleString()}</span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">evt/s</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span className="font-bold">{selectedStage.latencyMs}</span>
            <span className="text-slate-400 dark:text-slate-500 text-[11px]">ms</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
          Description
        </h4>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/80 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80">
          {selectedStage.description}
        </p>
      </div>

      {/* Technical Specifications */}
      {selectedStage.specs && (
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
            Technical Architecture Specs
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {selectedStage.specs.topicOrTable && (
              <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Target Stream / Table</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate mt-0.5">
                  {selectedStage.specs.topicOrTable}
                </span>
              </div>
            )}
            {selectedStage.specs.engineVersion && (
              <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Engine Version</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate mt-0.5">
                  {selectedStage.specs.engineVersion}
                </span>
              </div>
            )}
            {selectedStage.specs.clusterOrCatalog && (
              <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Cluster / Catalog URI</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate mt-0.5">
                  {selectedStage.specs.clusterOrCatalog}
                </span>
              </div>
            )}
            {selectedStage.specs.throughputTarget && (
              <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Target SLA / Throughput</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate mt-0.5">
                  {selectedStage.specs.throughputTarget}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backend API Integration Contract Hint */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="flex items-center gap-1">
            <Code className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            Future Backend API Contract
          </span>
          <span className="text-sky-600 dark:text-sky-400/80 text-[10px]">GET /api/pipeline/status</span>
        </div>
        <pre className="bg-slate-900 dark:bg-slate-950 p-2.5 rounded-lg text-[11px] font-mono text-slate-200 dark:text-slate-300 border border-slate-800 overflow-x-auto shadow-inner">
{JSON.stringify(
  {
    [selectedStage.id]: {
      status: selectedStage.status,
      eventsPerSecond: selectedStage.eventsPerSecond,
      latencyMs: selectedStage.latencyMs,
      errorRatePct: selectedStage.errorRatePct ?? 0,
    }
  },
  null,
  2
)}
        </pre>
      </div>

    </div>
  );
};
