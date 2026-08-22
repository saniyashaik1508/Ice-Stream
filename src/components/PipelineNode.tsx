import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PipelineNodeData, PipelineStatus } from '../types/pipeline';
import { 
  Radio, 
  Cpu, 
  Database, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  MinusCircle,
  Layers
} from 'lucide-react';

export const getStatusConfig = (status: PipelineStatus) => {
  switch (status) {
    case 'healthy':
      return {
        label: 'HEALTHY',
        color: 'text-emerald-400',
        dotColor: 'bg-emerald-400',
        bgPill: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        borderColor: 'border-emerald-500/40 hover:border-emerald-400',
        glowColor: 'shadow-emerald-500/10',
        selectedBorder: 'ring-2 ring-emerald-400 border-emerald-400',
        icon: CheckCircle2,
      };
    case 'warning':
      return {
        label: 'WARNING',
        color: 'text-amber-400',
        dotColor: 'bg-amber-400',
        bgPill: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        borderColor: 'border-amber-500/50 hover:border-amber-400',
        glowColor: 'shadow-amber-500/20',
        selectedBorder: 'ring-2 ring-amber-400 border-amber-400',
        icon: AlertTriangle,
      };
    case 'error':
      return {
        label: 'ERROR',
        color: 'text-rose-400',
        dotColor: 'bg-rose-400',
        bgPill: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        borderColor: 'border-rose-500/50 hover:border-rose-400',
        glowColor: 'shadow-rose-500/25',
        selectedBorder: 'ring-2 ring-rose-400 border-rose-400',
        icon: AlertOctagon,
      };
    case 'offline':
      return {
        label: 'OFFLINE',
        color: 'text-slate-400',
        dotColor: 'bg-slate-400',
        bgPill: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
        borderColor: 'border-slate-600 hover:border-slate-500',
        glowColor: 'shadow-slate-500/5',
        selectedBorder: 'ring-2 ring-slate-400 border-slate-400',
        icon: MinusCircle,
      };
  }
};

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

export const PipelineNode = memo(({ data, selected }: NodeProps<PipelineNodeData>) => {
  const statusCfg = getStatusConfig(data.status);
  const StageIcon = getStageIcon(data.id);

  return (
    <div
      className={`relative min-w-[270px] max-w-[290px] rounded-xl bg-slate-900/95 backdrop-blur-md border p-4 transition-all duration-200 shadow-xl ${
        selected ? statusCfg.selectedBorder : statusCfg.borderColor
      } ${statusCfg.glowColor}`}
    >
      {/* React Flow Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !-left-2 !bg-sky-500 !border-2 !border-slate-900 transition-transform hover:!scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !-right-2 !bg-sky-500 !border-2 !border-slate-900 transition-transform hover:!scale-125"
      />

      {/* Header: Stage Label & Status Pill */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800 text-sky-400 border border-slate-700/60 shadow-sm">
            <StageIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-mono tracking-wider font-semibold text-slate-400 uppercase">
              Stage
            </span>
            <h3 className="text-sm font-bold tracking-tight text-white leading-none">
              {data.label}
            </h3>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold tracking-wide ${statusCfg.bgPill}`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${statusCfg.dotColor} animate-pulse`} />
          <span>{statusCfg.label}</span>
        </div>
      </div>

      {/* Technology & Description */}
      <div className="py-2.5">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-400 font-medium">Technology</span>
          <span className="font-semibold text-sky-300 bg-sky-950/60 border border-sky-800/50 px-2 py-0.5 rounded text-[11px] font-mono">
            {data.technology}
          </span>
        </div>
        <p className="text-[12px] text-slate-400 line-clamp-2 leading-relaxed mt-1">
          {data.description}
        </p>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-2 gap-2 pt-2.5 mt-1 border-t border-slate-800/80 bg-slate-950/50 -mx-4 -mb-4 p-3 rounded-b-xl">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-[10px] uppercase font-mono text-slate-400 font-medium">
            <Activity className="w-3 h-3 text-sky-400" />
            <span>Events/sec</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-100 mt-0.5">
            {data.eventsPerSecond.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-[10px] uppercase font-mono text-slate-400 font-medium">
            <Clock className="w-3 h-3 text-sky-400" />
            <span>Latency</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-100 mt-0.5">
            {data.latencyMs} ms
          </span>
        </div>
      </div>
    </div>
  );
});

PipelineNode.displayName = 'PipelineNode';
