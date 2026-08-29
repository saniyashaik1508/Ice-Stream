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
  Layers,
  ShieldX,
} from 'lucide-react';

/** Extended status string — supports both Week 1 ('error') and Week 2 ('critical', 'quarantined', 'degraded') */
type ExtendedStatus = PipelineStatus | 'critical' | 'quarantined' | 'degraded';

export const getStatusConfig = (status: ExtendedStatus) => {
  switch (status) {
    case 'healthy':
      return {
        label: 'HEALTHY',
        color: 'text-emerald-600 dark:text-emerald-400',
        dotColor: 'bg-emerald-500 dark:bg-emerald-400',
        bgPill: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
        borderColor: 'border-emerald-400/50 dark:border-emerald-500/40 hover:border-emerald-500 dark:hover:border-emerald-400',
        glowColor: 'shadow-emerald-500/10',
        selectedBorder: 'ring-2 ring-emerald-500 dark:ring-emerald-400 border-emerald-500 dark:border-emerald-400',
        icon: CheckCircle2,
      };
    case 'warning':
      return {
        label: 'WARNING',
        color: 'text-amber-600 dark:text-amber-400',
        dotColor: 'bg-amber-500 dark:bg-amber-400',
        bgPill: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400',
        borderColor: 'border-amber-400/50 dark:border-amber-500/50 hover:border-amber-500 dark:hover:border-amber-400',
        glowColor: 'shadow-amber-500/20',
        selectedBorder: 'ring-2 ring-amber-500 dark:ring-amber-400 border-amber-500 dark:border-amber-400',
        icon: AlertTriangle,
      };
    // 'error' kept for Week 1 backward compatibility — renders as CRITICAL visually
    case 'error':
    case 'critical':
      return {
        label: 'CRITICAL',
        color: 'text-rose-600 dark:text-rose-400',
        dotColor: 'bg-rose-500 dark:bg-rose-400',
        bgPill: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400',
        borderColor: 'border-rose-400/50 dark:border-rose-500/50 hover:border-rose-500 dark:hover:border-rose-400',
        glowColor: 'shadow-rose-500/25',
        selectedBorder: 'ring-2 ring-rose-500 dark:ring-rose-400 border-rose-500 dark:border-rose-400',
        icon: AlertOctagon,
      };
    case 'quarantined':
      return {
        label: 'QUARANTINED',
        color: 'text-fuchsia-600 dark:text-fuchsia-400',
        dotColor: 'bg-fuchsia-500 dark:bg-fuchsia-400',
        bgPill: 'bg-fuchsia-50 dark:bg-fuchsia-500/10 border-fuchsia-200 dark:border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-400',
        borderColor: 'border-fuchsia-400/60 dark:border-fuchsia-500/50 hover:border-fuchsia-500 dark:hover:border-fuchsia-400',
        glowColor: 'shadow-fuchsia-500/25',
        selectedBorder: 'ring-2 ring-fuchsia-500 dark:ring-fuchsia-400 border-fuchsia-500 dark:border-fuchsia-400',
        icon: ShieldX,
      };
    case 'degraded':
      return {
        label: 'DEGRADED',
        color: 'text-orange-600 dark:text-orange-400',
        dotColor: 'bg-orange-500 dark:bg-orange-400',
        bgPill: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-400',
        borderColor: 'border-orange-400/50 dark:border-orange-500/50 hover:border-orange-500 dark:hover:border-orange-400',
        glowColor: 'shadow-orange-500/20',
        selectedBorder: 'ring-2 ring-orange-500 dark:ring-orange-400 border-orange-500 dark:border-orange-400',
        icon: AlertTriangle,
      };
    case 'offline':
    default:
      return {
        label: 'OFFLINE',
        color: 'text-slate-600 dark:text-slate-400',
        dotColor: 'bg-slate-400',
        bgPill: 'bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30 text-slate-600 dark:text-slate-400',
        borderColor: 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500',
        glowColor: 'shadow-slate-500/5',
        selectedBorder: 'ring-2 ring-slate-500 dark:ring-slate-400 border-slate-500 dark:border-slate-400',
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
      className={`relative min-w-[270px] max-w-[290px] rounded-xl bg-white dark:bg-slate-900 border p-4 transition-all duration-200 shadow-md dark:shadow-xl ${
        selected ? statusCfg.selectedBorder : statusCfg.borderColor
      } ${statusCfg.glowColor}`}
    >
      {/* React Flow Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !-left-2 !bg-sky-500 !border-2 !border-white dark:!border-slate-900 transition-transform hover:!scale-125 shadow-sm"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !-right-2 !bg-sky-500 !border-2 !border-white dark:!border-slate-900 transition-transform hover:!scale-125 shadow-sm"
      />

      {/* Header: Stage Label & Status Pill */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-700/60 shadow-xs">
            <StageIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-mono tracking-wider font-semibold text-slate-400 dark:text-slate-500 uppercase">
              Stage
            </span>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
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
          <span className="text-slate-500 dark:text-slate-400 font-medium">Technology</span>
          <span className="font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/50 px-2 py-0.5 rounded text-[11px] font-mono">
            {data.technology}
          </span>
        </div>
        <p className="text-[12px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mt-1">
          {data.description}
        </p>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-2 gap-2 pt-2.5 mt-1 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/50 -mx-4 -mb-4 p-3 rounded-b-xl">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-medium">
            <Activity className="w-3 h-3 text-sky-500 dark:text-sky-400" />
            <span>Events/sec</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {data.eventsPerSecond.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-medium">
            <Clock className="w-3 h-3 text-sky-500 dark:text-sky-400" />
            <span>Latency</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {data.latencyMs} ms
          </span>
        </div>
      </div>
    </div>
  );
});

PipelineNode.displayName = 'PipelineNode';
