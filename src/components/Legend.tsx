import React from 'react';
import { Info } from 'lucide-react';

export const Legend: React.FC = () => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Pipeline Status Legend:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>● Healthy</span>
            <span className="text-[10px] text-emerald-500/80 hidden md:inline">(Normal SLA)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>● Warning</span>
            <span className="text-[10px] text-amber-500/80 hidden md:inline">(Lag / Pressure)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>● Error</span>
            <span className="text-[10px] text-rose-500/80 hidden md:inline">(Anomalous / Blocked)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-500/10 border border-slate-500/30 text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>● Offline</span>
            <span className="text-[10px] text-slate-500 hidden md:inline">(Unreachable)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
