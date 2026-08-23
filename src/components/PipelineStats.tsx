import React from 'react';
import { PipelineSummaryMetrics } from '../types/pipeline';
import { 
  Zap, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  TrendingUp
} from 'lucide-react';

interface PipelineStatsProps {
  summary: PipelineSummaryMetrics;
}

export const PipelineStats: React.FC<PipelineStatsProps> = ({ summary }) => {
  const isAllHealthy = summary.healthyStages === summary.totalStages;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Card 1: Total Events/sec */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-md backdrop-blur-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Events / Sec
          </span>
          <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tracking-tight">
            {summary.totalEventsPerSecond.toLocaleString()}
          </span>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
            <TrendingUp className="w-3 h-3 inline" />
            live
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Ingest streaming throughput
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Card 2: Pipeline Health */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-md backdrop-blur-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Pipeline Health
          </span>
          <div className={`p-2 rounded-lg border ${
            isAllHealthy
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
          }`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tracking-tight">
            {summary.healthyStages}/{summary.totalStages}
          </span>
          <span className={`text-xs font-mono font-semibold ${isAllHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {isAllHealthy ? 'Healthy' : 'Degraded'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Active operational stages
        </p>
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity ${
          isAllHealthy ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-rose-500'
        }`} />
      </div>

      {/* Card 3: Avg Latency */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-md backdrop-blur-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Avg Latency
          </span>
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tracking-tight">
            {summary.avgLatencyMs}
          </span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">ms</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          End-to-end stage traversal
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Card 4: Active Alerts */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-md backdrop-blur-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Alerts
          </span>
          <div className={`p-2 rounded-lg border ${
            summary.activeAlertCount === 0
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
          }`}>
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-2xl font-mono font-bold tracking-tight ${
            summary.activeAlertCount === 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {summary.activeAlertCount}
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {summary.activeAlertCount === 0 ? 'no anomalies' : 'action required'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Data quality & lag warnings
        </p>
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity ${
          summary.activeAlertCount === 0 ? 'bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700' : 'bg-gradient-to-r from-rose-500 to-amber-500'
        }`} />
      </div>
    </div>
  );
};
