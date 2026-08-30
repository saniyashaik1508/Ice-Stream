import React from 'react';
import { Info } from 'lucide-react';

export const Legend: React.FC = () => {
  return (
    <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm dark:shadow-md backdrop-blur-sm transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Pipeline Status Legend:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span>Healthy</span>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 hidden md:inline">(Normal SLA)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
            <span>Warning</span>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-500/80 hidden md:inline">(Lag / Pressure)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-rose-400" />
            <span>Critical</span>
            <span className="text-[10px] text-rose-600/80 dark:text-rose-500/80 hidden md:inline">(Anomaly Detected)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-fuchsia-50 dark:bg-fuchsia-500/10 border border-fuchsia-200 dark:border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-fuchsia-500 dark:bg-fuchsia-400" />
            <span>Quarantined</span>
            <span className="text-[10px] text-fuchsia-600/80 dark:text-fuchsia-500/80 hidden md:inline">(Paused / Blocked)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-500/10 border border-slate-200 dark:border-slate-500/30 text-slate-600 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Offline</span>
            <span className="text-[10px] text-slate-500 hidden md:inline">(Unreachable)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
