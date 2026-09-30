/**
 * IceStream — SelfHealingPanel Component
 *
 * The primary UI surface for the self-healing system. Organised into four tabs:
 *
 *   1. OVERVIEW  — health score gauge, last action, engine status, quick triggers
 *   2. AUDIT LOG — every healing action with status, duration, log, and health delta
 *   3. POLICIES  — live rule editor: enable/disable + threshold tuning per policy
 *   4. DLQ QUEUE — enriched Dead Letter Queue with per-record retry + fix suggestions
 */

import React, { useState } from 'react';
import {
  Heart,
  Zap,
  ClipboardList,
  Settings2,
  Database,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Shield,
  GitMerge,
  RefreshCw,
  TrendingUp,
  X,
  Power,
  Layers,
} from 'lucide-react';
import {
  HealingAction,
  HealingActionType,
  HealingPolicy,
  HealingEngineState,
  DLQRecord,
  ProbeResult,
  HealthScore,
} from '../types/healing';
import { HealthScoreGauge } from './HealthScoreGauge';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SelfHealingPanelProps {
  enabled: boolean;
  mode: HealingEngineState['mode'];
  actions: HealingAction[];
  policies: HealingPolicy[];
  healthScore: HealthScore;
  dlqRecords: DLQRecord[];
  lastProbe?: ProbeResult;
  totalAutoResolved: number;
  totalManualResolved: number;
  pendingDLQ: number;
  runningCount: number;

  // Manual triggers
  onCircuitProbe: () => void;
  onDLQRetry: () => void;
  onSchemaCoerce: () => void;
  onBackpressure: () => void;
  onThroughputBoost: () => void;
  onHealthProbe: () => void;

  // Controls
  onToggleEnabled: () => void;
  onSetMode: (mode: HealingEngineState['mode']) => void;
  onUpdatePolicy: (id: string, patch: Partial<HealingPolicy>) => void;
  onDismissDLQ: (id: string) => void;
  onClearSucceeded: () => void;
}

// ─── Shared style helpers ──────────────────────────────────────────────────────

const TAB_BASE = 'px-3 py-1.5 text-[11px] font-mono font-semibold rounded-lg transition-all duration-150';
const TAB_ACTIVE = 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm';
const TAB_IDLE = 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';

const ACTION_ICON: Record<HealingActionType, React.ElementType> = {
  circuit_probe:       Shield,
  dlq_retry:           RotateCcw,
  dlq_batch_retry:     RotateCcw,
  rule_disable:        XCircle,
  rule_reenable:       CheckCircle2,
  schema_coerce:       GitMerge,
  backpressure_relief: TrendingUp,
  throughput_boost:    Zap,
  quarantine_release:  Layers,
  alert_suppress:      AlertTriangle,
  snapshot_rollback:   RefreshCw,
  health_probe:        Cpu,
};

const ACTION_LABELS: Record<HealingActionType, string> = {
  circuit_probe:       'Circuit Probe',
  dlq_retry:           'DLQ Retry',
  dlq_batch_retry:     'DLQ Batch Retry',
  rule_disable:        'Rule Disabled',
  rule_reenable:       'Rule Re-enabled',
  schema_coerce:       'Schema Coercion',
  backpressure_relief: 'Backpressure Relief',
  throughput_boost:    'Throughput Boost',
  quarantine_release:  'Quarantine Release',
  alert_suppress:      'Alert Suppressed',
  snapshot_rollback:   'Snapshot Rollback',
  health_probe:        'Health Probe',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealingAction['status'] }) {
  const cfg = {
    pending:   'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    running:   'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 animate-pulse',
    succeeded: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    failed:    'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',
    skipped:   'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  }[status];
  const labels = { pending: 'PENDING', running: 'RUNNING', succeeded: 'DONE', failed: 'FAILED', skipped: 'SKIPPED' };
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${cfg}`}>{labels[status]}</span>;
}

function TriggerBadge({ trigger }: { trigger: HealingAction['trigger'] }) {
  return trigger === 'automatic'
    ? <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">AUTO</span>
    : <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">MANUAL</span>;
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour12: false }); }
  catch { return iso; }
}

function formatDuration(start: string, end?: string): string {
  try {
    const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  } catch { return '—'; }
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  enabled, mode, healthScore, totalAutoResolved, totalManualResolved,
  lastProbe, runningCount, pendingDLQ, actions,
  onCircuitProbe, onDLQRetry, onSchemaCoerce,
  onBackpressure, onThroughputBoost, onHealthProbe,
  onToggleEnabled, onSetMode,
}: Pick<SelfHealingPanelProps,
  'enabled' | 'mode' | 'healthScore' | 'totalAutoResolved' | 'totalManualResolved' |
  'lastProbe' | 'runningCount' | 'pendingDLQ' | 'actions' |
  'onCircuitProbe' | 'onDLQRetry' | 'onSchemaCoerce' |
  'onBackpressure' | 'onThroughputBoost' | 'onHealthProbe' |
  'onToggleEnabled' | 'onSetMode'
>) {
  const lastAction = actions[0] ?? null;

  const QUICK_ACTIONS = [
    { label: 'Circuit Probe',    Icon: Shield,    fn: onCircuitProbe,    color: 'text-sky-600 dark:text-sky-400',     border: 'border-sky-200 dark:border-sky-500/30',     bg: 'hover:bg-sky-50 dark:hover:bg-sky-500/10'    },
    { label: 'DLQ Retry',        Icon: RotateCcw, fn: onDLQRetry,        color: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-500/30', bg: 'hover:bg-violet-50 dark:hover:bg-violet-500/10'},
    { label: 'Schema Coerce',    Icon: GitMerge,  fn: onSchemaCoerce,    color: 'text-amber-600 dark:text-amber-400',  border: 'border-amber-200 dark:border-amber-500/30',  bg: 'hover:bg-amber-50 dark:hover:bg-amber-500/10' },
    { label: 'Relieve Backpressure', Icon: TrendingUp, fn: onBackpressure, color: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-500/30', bg: 'hover:bg-orange-50 dark:hover:bg-orange-500/10' },
    { label: 'Boost Throughput', Icon: Zap,       fn: onThroughputBoost, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', bg: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10' },
    { label: 'Health Probe',     Icon: Cpu,       fn: onHealthProbe,     color: 'text-slate-600 dark:text-slate-400',  border: 'border-slate-200 dark:border-slate-700',     bg: 'hover:bg-slate-50 dark:hover:bg-slate-800'   },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Engine status bar ── */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
        <button
          onClick={onToggleEnabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors border ${
            enabled
              ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600'
              : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Power className="w-3 h-3" />
          {enabled ? 'Engine ON' : 'Engine OFF'}
        </button>

        <div className="flex gap-1">
          {(['proactive', 'reactive', 'manual'] as const).map(m => (
            <button
              key={m}
              onClick={() => onSetMode(m)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors border ${
                mode === m
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {runningCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 animate-pulse">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            {runningCount} running
          </span>
        )}
      </div>

      {/* ── Health gauge + KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex justify-center items-center p-4 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
          <HealthScoreGauge score={healthScore} />
        </div>

        <div className="grid grid-cols-2 gap-2 content-start">
          {[
            { label: 'Auto-Resolved', value: totalAutoResolved, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Manual-Resolved', value: totalManualResolved, color: 'text-sky-600 dark:text-sky-400' },
            { label: 'DLQ Pending', value: pendingDLQ, color: pendingDLQ > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300' },
            { label: 'Actions Fired', value: actions.length, color: 'text-slate-700 dark:text-slate-200' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <span className={`text-xl font-bold font-mono ${color}`}>{value}</span>
              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</span>
            </div>
          ))}

          {/* Last probe result */}
          {lastProbe && (
            <div className="col-span-2 flex flex-col gap-1 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">Last Circuit Probe</span>
              <div className="flex items-center gap-2">
                {lastProbe.succeeded
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                <span className="text-[11px] font-mono text-slate-700 dark:text-slate-200">
                  {lastProbe.passed}/{lastProbe.probeSize} passed · err {(lastProbe.observedErrorRate * 100).toFixed(1)}%
                </span>
                <span className={`text-[10px] font-mono font-bold ${lastProbe.succeeded ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  → {lastProbe.decision.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Last healing action ── */}
      {lastAction && (
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${
          lastAction.status === 'succeeded' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30' :
          lastAction.status === 'failed'    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30' :
          lastAction.status === 'running'   ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-500/30' :
          'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'
        }`}>
          {(() => { const Icon = ACTION_ICON[lastAction.type]; return <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-600 dark:text-slate-300" />; })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-100">{ACTION_LABELS[lastAction.type]}</span>
              <StatusBadge status={lastAction.status} />
              <TriggerBadge trigger={lastAction.trigger} />
              <span className="text-[10px] font-mono text-slate-400">{formatTime(lastAction.startedAt)}</span>
              {lastAction.healthDelta !== undefined && lastAction.healthDelta > 0 && (
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">+{lastAction.healthDelta} pts</span>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-0.5 leading-tight truncate">{lastAction.description}</p>
          </div>
        </div>
      )}

      {/* ── Quick manual triggers ── */}
      <div className="flex flex-col gap-2">
        <h4 className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Manual Triggers</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUICK_ACTIONS.map(({ label, Icon, fn, color, border, bg }) => (
            <button
              key={label}
              onClick={fn}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-mono font-semibold border bg-white dark:bg-slate-900 ${border} ${bg} ${color} transition-all duration-150 shadow-sm hover:shadow`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Audit Log ───────────────────────────────────────────────────────────

function AuditLogTab({ actions, onClearSucceeded }: { actions: HealingAction[]; onClearSucceeded: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{actions.length} total actions</span>
        {actions.some(a => a.status === 'succeeded') && (
          <button onClick={onClearSucceeded} className="text-[11px] font-mono text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors">
            Clear completed
          </button>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="py-10 text-center text-[12px] font-mono text-slate-400 dark:text-slate-500">
          No healing actions yet. The engine will fire automatically when policies are breached.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {actions.map(action => {
            const Icon = ACTION_ICON[action.type];
            const isExpanded = expandedId === action.id;
            return (
              <div
                key={action.id}
                className={`border rounded-xl overflow-hidden transition-colors ${
                  action.status === 'running'   ? 'border-sky-200 dark:border-sky-500/30 bg-sky-50/30 dark:bg-sky-950/10' :
                  action.status === 'succeeded' ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/5' :
                  action.status === 'failed'    ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/10' :
                  'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20'
                }`}
              >
                {/* Summary row */}
                <button
                  className="w-full flex items-start gap-3 p-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : action.id)}
                >
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-100">{ACTION_LABELS[action.type]}</span>
                      <StatusBadge status={action.status} />
                      <TriggerBadge trigger={action.trigger} />
                      <span className="text-[10px] font-mono text-slate-400">{formatTime(action.startedAt)}</span>
                      <span className="text-[10px] font-mono text-slate-400">{formatDuration(action.startedAt, action.completedAt)}</span>
                      {action.healthDelta !== undefined && action.healthDelta > 0 && (
                        <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">+{action.healthDelta} pts</span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-0.5 leading-tight truncate">{action.description}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                </button>

                {/* Expanded log */}
                {isExpanded && (
                  <div className="border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-950/5 dark:bg-slate-950/30 px-4 py-3">
                    <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                      {action.log}
                    </pre>
                    {action.errorMessage && (
                      <p className="mt-2 text-[10px] font-mono text-rose-600 dark:text-rose-400">{action.errorMessage}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Policies ────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<HealingPolicy['triggerMetric'], string> = {
  error_rate:    'Error Rate',
  null_rate:     'NULL Rate',
  latency_ms:    'Latency (ms)',
  throughput_eps:'Throughput (eps)',
  dlq_depth:     'DLQ Depth',
  circuit_state: 'Circuit State',
  health_score:  'Health Score',
};

function PoliciesTab({ policies, onUpdatePolicy }: { policies: HealingPolicy[]; onUpdatePolicy: (id: string, patch: Partial<HealingPolicy>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
        Healing policies evaluate every 4 s. Disable or tune thresholds to control autonomous behaviour.
      </p>
      <div className="flex flex-col gap-2">
        {policies.map(policy => (
          <div key={policy.id} className={`border rounded-xl p-3 transition-colors ${
            policy.enabled
              ? 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
              : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/50 opacity-60'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col flex-1 min-w-0 gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100">{policy.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                    {ACTION_LABELS[policy.action]}
                  </span>
                  {policy.fireCount > 0 && (
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">fired {policy.fireCount}×</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-relaxed">{policy.description}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-slate-400">
                    Trigger: <span className="text-slate-600 dark:text-slate-300">{METRIC_LABELS[policy.triggerMetric]}</span>
                  </span>
                  {policy.triggerMetric !== 'circuit_state' && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Threshold:{' '}
                      <span className="text-slate-600 dark:text-slate-300">
                        {policy.comparator} {policy.threshold}
                      </span>
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400">
                    Cooldown: <span className="text-slate-600 dark:text-slate-300">{policy.cooldownSeconds}s</span>
                  </span>
                  {policy.lastFiredAt && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Last: <span className="text-slate-600 dark:text-slate-300">{formatTime(policy.lastFiredAt)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => onUpdatePolicy(policy.id, { enabled: !policy.enabled })}
                className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                  policy.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title={policy.enabled ? 'Disable policy' : 'Enable policy'}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  policy.enabled ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: DLQ Queue ───────────────────────────────────────────────────────────

const RETRY_STATUS_CFG = {
  pending:     { label: 'PENDING',  cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  retrying:    { label: 'RETRYING', cls: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 animate-pulse' },
  succeeded:   { label: 'DONE',     cls: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
  exhausted:   { label: 'EXHAUSTED',cls: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' },
  manual_hold: { label: 'HOLD',     cls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
};

function DLQTab({ dlqRecords, onDismiss }: { dlqRecords: DLQRecord[]; onDismiss: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          {dlqRecords.length} records · {dlqRecords.filter(r => r.retryStatus === 'pending').length} pending retry
        </span>
      </div>
      {dlqRecords.length === 0 ? (
        <div className="py-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
          <p className="text-[12px] font-mono text-slate-400 dark:text-slate-500">DLQ is empty — no records in quarantine</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {dlqRecords.map(record => {
            const statusCfg = RETRY_STATUS_CFG[record.retryStatus];
            const isExpanded = expandedId === record.id;
            return (
              <div key={record.id} className={`border rounded-xl overflow-hidden transition-colors ${
                record.retryStatus === 'succeeded' ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/5' :
                record.retryStatus === 'exhausted' ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/20 dark:bg-rose-950/5' :
                'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20'
              }`}>
                <div className="flex items-start gap-3 p-3">
                  <Database className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{record.id}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${statusCfg.cls}`}>{statusCfg.label}</span>
                      {record.faultType && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">{record.faultType}</span>
                      )}
                      <span className="text-[9px] font-mono text-slate-400">retry {record.retryCount}/{3}</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">{record.failedRule}</p>
                    {record.suggestedFix && (
                      <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 leading-tight">
                        💡 {record.suggestedFix}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => onDismiss(record.id)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-950/5 dark:bg-slate-950/30 px-4 py-3">
                    <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {JSON.stringify(record.payload, null, 2)}
                    </pre>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
                      <span>Quarantined: {formatTime(record.quarantinedAt)}</span>
                      {record.lastRetriedAt && <span>Last retry: {formatTime(record.lastRetriedAt)}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'audit' | 'policies' | 'dlq';

export const SelfHealingPanel: React.FC<SelfHealingPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: Array<{ id: Tab; label: string; Icon: React.ElementType; badge?: number }> = [
    { id: 'overview',  label: 'Overview',  Icon: Heart },
    { id: 'audit',     label: 'Audit Log', Icon: ClipboardList, badge: props.runningCount > 0 ? props.runningCount : undefined },
    { id: 'policies',  label: 'Policies',  Icon: Settings2 },
    { id: 'dlq',       label: 'DLQ Queue', Icon: Database, badge: props.pendingDLQ > 0 ? props.pendingDLQ : undefined },
  ];

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl backdrop-blur-md overflow-hidden transition-colors">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border transition-colors ${
            props.enabled
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
          }`}>
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Self-Healing Pipeline</h2>
              {props.enabled && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Proactive data quality engineering · {props.mode} mode · score {props.healthScore.overall}/100
            </p>
          </div>
        </div>
        <HealthScoreGauge score={props.healthScore} compact />
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
        {tabs.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`${TAB_BASE} flex items-center gap-1.5 relative ${activeTab === id ? TAB_ACTIVE : TAB_IDLE}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge !== undefined && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full text-[8px] font-bold bg-rose-500 text-white px-0.5">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <OverviewTab
            enabled={props.enabled}
            mode={props.mode}
            healthScore={props.healthScore}
            totalAutoResolved={props.totalAutoResolved}
            totalManualResolved={props.totalManualResolved}
            lastProbe={props.lastProbe}
            runningCount={props.runningCount}
            pendingDLQ={props.pendingDLQ}
            actions={props.actions}
            onCircuitProbe={props.onCircuitProbe}
            onDLQRetry={props.onDLQRetry}
            onSchemaCoerce={props.onSchemaCoerce}
            onBackpressure={props.onBackpressure}
            onThroughputBoost={props.onThroughputBoost}
            onHealthProbe={props.onHealthProbe}
            onToggleEnabled={props.onToggleEnabled}
            onSetMode={props.onSetMode}
          />
        )}
        {activeTab === 'audit' && (
          <AuditLogTab actions={props.actions} onClearSucceeded={props.onClearSucceeded} />
        )}
        {activeTab === 'policies' && (
          <PoliciesTab policies={props.policies} onUpdatePolicy={props.onUpdatePolicy} />
        )}
        {activeTab === 'dlq' && (
          <DLQTab dlqRecords={props.dlqRecords} onDismiss={props.onDismissDLQ} />
        )}
      </div>
    </div>
  );
};
