import React from 'react';
import { PipelineStatus } from '../types/pipeline';
import { SimulationScenario } from '../hooks/usePipelineSimulation';
import { useTheme } from '../context/ThemeContext';
import { 
  Activity, 
  Play, 
  Pause, 
  RotateCcw, 
  RefreshCw, 
  Waves,
  Sun,
  Moon
} from 'lucide-react';

interface PipelineHeaderProps {
  systemStatus: PipelineStatus;
  lastUpdated: string;
  isLive: boolean;
  onToggleLive: () => void;
  onRefresh: () => void;
  activeScenario: SimulationScenario;
  onSelectScenario: (scenario: SimulationScenario) => void;
  onReset: () => void;
}

export const PipelineHeader: React.FC<PipelineHeaderProps> = ({
  systemStatus,
  lastUpdated,
  isLive,
  onToggleLive,
  onRefresh,
  activeScenario,
  onSelectScenario,
  onReset,
}) => {
  const { theme, toggleTheme } = useTheme();

  const getOverallStatusBadge = () => {
    switch (systemStatus) {
      case 'healthy':
        return {
          text: 'SYSTEM OPERATIONAL',
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
          dot: 'bg-emerald-500 dark:bg-emerald-400',
        };
      case 'warning':
        return {
          text: 'SYSTEM DEGRADED',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
          dot: 'bg-amber-500 dark:bg-amber-400',
        };
      case 'error':
        return {
          text: 'SYSTEM ANOMALY DETECTED',
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
          dot: 'bg-rose-500 dark:bg-rose-400',
        };
      case 'offline':
      default:
        return {
          text: 'SYSTEM OFFLINE',
          bg: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400',
          dot: 'bg-slate-500 dark:bg-slate-400',
        };
    }
  };

  const statusBadge = getOverallStatusBadge();

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md sticky top-0 z-20 px-4 lg:px-8 py-3.5 shadow-sm dark:shadow-lg transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Logo & Subtitle */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-md dark:shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
            <Waves className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
                IceStream
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Week 1 Observability
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Real-Time Lakehouse Observability & Data Lineage
            </p>
          </div>
        </div>

        {/* System Health, Simulation Controls & Theme Toggle */}
        <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto justify-between md:justify-end">
          
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold tracking-wide shadow-sm ${statusBadge.bg}`}>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusBadge.dot} animate-ping`} />
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusBadge.dot} -ml-4.5`} />
            <span>● {statusBadge.text}</span>
          </div>

          {/* Clock */}
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 flex items-center gap-1.5 shadow-sm">
            <Activity className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span className="text-slate-400 dark:text-slate-500">Updated:</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">{lastUpdated}</span>
          </div>

          {/* Simulation Toggle and Scenario Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              onClick={onToggleLive}
              title={isLive ? "Pause simulation" : "Resume live simulation"}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 px-2.5 ${
                isLive
                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 shadow-xs'
              }`}
            >
              {isLive ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px] font-mono">LIVE</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline text-[11px] font-mono">PAUSED</span>
                </>
              )}
            </button>

            <button
              onClick={onRefresh}
              title="Trigger instant metric update"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Scenario Quick Selector */}
            <select
              value={activeScenario}
              onChange={(e) => onSelectScenario(e.target.value as SimulationScenario)}
              className="text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 text-slate-800 dark:text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-xs"
              title="Select simulation test scenario"
            >
              <option value="healthy">Test: Healthy (100%)</option>
              <option value="warning-lag">Test: Ingest Kafka Lag</option>
              <option value="flink-backpressure">Test: Flink Backpressure</option>
              <option value="iceberg-commit-delay">Test: Iceberg Delay</option>
            </select>

            <button
              onClick={onReset}
              title="Reset all stages to default baseline"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dark / Light Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all duration-200 shadow-sm"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-medium hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-mono font-medium hidden sm:inline">Dark</span>
              </>
            )}
          </button>

        </div>

      </div>
    </header>
  );
};
