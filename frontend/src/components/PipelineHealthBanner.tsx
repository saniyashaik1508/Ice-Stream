/**
 * IceStream — Pipeline Health Banner
 *
 * Full-width banner showing overall pipeline operational state.
 * Prominently communicates OPERATIONAL / DEGRADED / QUARANTINED / RECOVERING.
 */

import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldOff, RefreshCw } from 'lucide-react';
import { PipelineOperationalState } from '../types/observability';

interface PipelineHealthBannerProps {
  pipelineState: PipelineOperationalState;
  quarantinedNodes: string[];
  lastPolled: string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

function getStateDisplay(state: PipelineOperationalState) {
  switch (state) {
    case 'operational':
      return {
        icon: ShieldCheck,
        label: 'PIPELINE OPERATIONAL',
        description: 'All stages healthy. No anomalies detected.',
        bg: 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20',
        iconCls: 'text-emerald-500 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15',
        textCls: 'text-emerald-700 dark:text-emerald-300',
        dotCls: 'bg-emerald-500 dark:bg-emerald-400',
      };
    case 'degraded':
      return {
        icon: ShieldAlert,
        label: 'PIPELINE DEGRADED',
        description: 'One or more stages are operating below normal parameters.',
        bg: 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20',
        iconCls: 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15',
        textCls: 'text-amber-700 dark:text-amber-300',
        dotCls: 'bg-amber-500 dark:bg-amber-400',
      };
    case 'quarantined':
      return {
        icon: ShieldX,
        label: 'PIPELINE QUARANTINED',
        description: 'Critical anomaly detected. Affected stages paused and quarantined.',
        bg: 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20',
        iconCls: 'text-rose-500 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/15',
        textCls: 'text-rose-700 dark:text-rose-300',
        dotCls: 'bg-rose-500 dark:bg-rose-400',
      };
    case 'recovering':
      return {
        icon: RefreshCw,
        label: 'PIPELINE RECOVERING',
        description: 'Automated recovery in progress. Monitoring elevated.',
        bg: 'bg-sky-50 dark:bg-sky-500/5 border-sky-200 dark:border-sky-500/20',
        iconCls: 'text-sky-500 dark:text-sky-400 bg-sky-100 dark:bg-sky-500/15',
        textCls: 'text-sky-700 dark:text-sky-300',
        dotCls: 'bg-sky-500 dark:bg-sky-400',
      };
    default:
      return {
        icon: ShieldOff,
        label: 'PIPELINE OFFLINE',
        description: 'Unable to determine pipeline state.',
        bg: 'bg-slate-100 dark:bg-slate-500/5 border-slate-200 dark:border-slate-500/20',
        iconCls: 'text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-500/15',
        textCls: 'text-slate-700 dark:text-slate-300',
        dotCls: 'bg-slate-400',
      };
  }
}

export const PipelineHealthBanner: React.FC<PipelineHealthBannerProps> = ({
  pipelineState,
  quarantinedNodes,
  lastPolled,
  isLoading,
  error,
  onRetry,
}) => {
  const display = getStateDisplay(pipelineState);
  const StateIcon = display.icon;

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300">
        <div className="flex items-center gap-2">
          <ShieldX className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-mono font-semibold">
            Unable to connect to observability service.
          </span>
        </div>
        <button
          onClick={onRetry}
          className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-200 dark:hover:bg-rose-500/30 transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-xs font-mono">Loading pipeline status...</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border ${display.bg} transition-all duration-300`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${display.iconCls}`}>
          <StateIcon className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${display.dotCls} ${pipelineState !== 'operational' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-mono font-bold tracking-wider ${display.textCls}`}>
              {display.label}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
            {display.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
        {quarantinedNodes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <ShieldX className="w-3.5 h-3.5 text-rose-500" />
            <span>Quarantined: <strong className="text-rose-600 dark:text-rose-400 uppercase">{quarantinedNodes.join(', ')}</strong></span>
          </div>
        )}
        <span>Polled: {lastPolled}</span>
      </div>
    </div>
  );
};
