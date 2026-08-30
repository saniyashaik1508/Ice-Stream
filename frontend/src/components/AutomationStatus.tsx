/**
 * IceStream — Automation Status Panel
 *
 * Shows the automated response steps taken in response to an incident.
 * Steps are driven by state (done | pending | skipped), never hardcoded text.
 */

import React from 'react';
import { Bot, CheckCircle2, Loader2, MinusCircle } from 'lucide-react';
import { AutomationStep, PipelineOperationalState } from '../types/observability';

interface AutomationStatusProps {
  steps: AutomationStep[];
  pipelineState: PipelineOperationalState;
}

function getStateConfig(state: PipelineOperationalState) {
  switch (state) {
    case 'operational':
      return { label: 'OPERATIONAL', cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' };
    case 'degraded':
      return { label: 'DEGRADED', cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' };
    case 'quarantined':
      return { label: 'QUARANTINED', cls: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30' };
    case 'recovering':
      return { label: 'RECOVERING', cls: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30' };
    default:
      return { label: 'OFFLINE', cls: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30' };
  }
}

export const AutomationStatus: React.FC<AutomationStatusProps> = ({ steps, pipelineState }) => {
  const stateCfg = getStateConfig(pipelineState);

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl backdrop-blur-md flex flex-col gap-3 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
              Automation Status
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              IceStream automated response engine
            </p>
          </div>
        </div>

        {/* Pipeline State Badge */}
        <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${stateCfg.cls}`}>
          {stateCfg.label}
        </span>
      </div>

      {/* Step List */}
      <div className="flex flex-col gap-1.5">
        {steps.map(step => {
          const isDone = step.status === 'done';
          const isPending = step.status === 'pending';
          const isSkipped = step.status === 'skipped';

          return (
            <div
              key={step.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                isDone
                  ? 'bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10'
                  : isPending
                  ? 'bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10'
                  : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60'
              }`}
            >
              {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />}
              {isPending && <Loader2 className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 animate-spin" />}
              {isSkipped && <MinusCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />}
              <span
                className={`text-xs font-mono font-medium ${
                  isDone
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : isPending
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-slate-400 dark:text-slate-500 line-through'
                }`}
              >
                {step.label}
              </span>
              {isPending && (
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 ml-auto">
                  in progress
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
