/**
 * IceStream — Incident Simulator
 *
 * Provides 5 scenario buttons that drive both the pipeline node simulation
 * (usePipelineSimulation) and the observability alert system (useObservability).
 * State is owned by parent; this component only fires callbacks.
 */

import React from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  Zap,
  Clock,
  ShieldAlert,
  FlaskConical,
} from 'lucide-react';
import { IncidentScenario } from '../types/observability';
import { SimulationScenario } from '../hooks/usePipelineSimulation';

interface ScenarioButton {
  scenario: IncidentScenario;
  simScenario: SimulationScenario;
  label: string;
  subLabel: string;
  icon: React.ElementType;
  colorClasses: string;
  activeColorClasses: string;
}

const SCENARIOS: ScenarioButton[] = [
  {
    scenario: 'healthy',
    simScenario: 'healthy',
    label: 'Healthy',
    subLabel: 'All stages operational',
    icon: CheckCircle2,
    colorClasses:
      'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400',
    activeColorClasses:
      'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  {
    scenario: 'high-null-rate',
    simScenario: 'high-null-rate',
    label: 'High NULL Rate',
    subLabel: 'PROCESS → CRITICAL',
    icon: AlertOctagon,
    colorClasses:
      'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-600 dark:hover:border-rose-500 dark:hover:text-rose-400',
    activeColorClasses:
      'border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    scenario: 'schema-drift',
    simScenario: 'schema-drift',
    label: 'Schema Drift',
    subLabel: 'PROCESS → CRITICAL',
    icon: ShieldAlert,
    colorClasses:
      'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-600 dark:hover:border-rose-500 dark:hover:text-rose-400',
    activeColorClasses:
      'border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    scenario: 'low-throughput',
    simScenario: 'low-throughput',
    label: 'Low Throughput',
    subLabel: 'INGEST → WARNING',
    icon: Zap,
    colorClasses:
      'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-500 dark:hover:text-amber-400',
    activeColorClasses:
      'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    scenario: 'high-latency',
    simScenario: 'high-latency',
    label: 'High Latency',
    subLabel: 'PROCESS → WARNING',
    icon: Clock,
    colorClasses:
      'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-500 dark:hover:text-amber-400',
    activeColorClasses:
      'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
];

interface IncidentSimulatorProps {
  activeScenario: IncidentScenario;
  onSelectScenario: (obs: IncidentScenario, sim: SimulationScenario) => void;
}

export const IncidentSimulator: React.FC<IncidentSimulatorProps> = ({
  activeScenario,
  onSelectScenario,
}) => {
  return (
    <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl backdrop-blur-md transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
          <FlaskConical className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
            Incident Simulator
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Select a scenario to simulate a pipeline incident
          </p>
        </div>
      </div>

      {/* Scenario Buttons */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map(({ scenario, simScenario, label, subLabel, icon: Icon, colorClasses, activeColorClasses }) => {
          const isActive = activeScenario === scenario;
          return (
            <button
              key={scenario}
              onClick={() => onSelectScenario(scenario, simScenario)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
                isActive ? activeColorClasses : colorClasses + ' bg-white dark:bg-slate-900'
              }`}
              title={subLabel}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{label}</span>
              {isActive && (
                <span className="text-[10px] font-normal opacity-70 hidden sm:inline">
                  · {subLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active scenario description */}
      {activeScenario !== 'healthy' && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span className="text-slate-700 dark:text-slate-300 font-semibold">Active: </span>
          {SCENARIOS.find(s => s.scenario === activeScenario)?.subLabel}
          {' '}— Check the Pipeline Flow and Alert Panel below.
        </div>
      )}
    </div>
  );
};
