/**
 * IceStream — Incident Log Component
 *
 * A detailed, timeline-style incident log showing:
 *   • WHY each pipeline pause occurred (cause chain + technical details)
 *   • WHEN it paused and when it resumed (ISO timestamps)
 *   • Full state-transition history (OPEN → HALF_OPEN → CLOSED)
 *   • Duration of the outage
 *   • Error rate at pause and at resume
 *   • Expandable rows for full technical details
 *   • Filter controls (status / node / trigger)
 *   • Live "open" badge for currently active incidents
 */

import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Zap,
  Activity,
} from 'lucide-react';
import {
  IncidentLogEntry,
  IncidentLifecycleStatus,
  IncidentTrigger,
  CircuitBreakerNodeId,
  IncidentLogFilter,
  IncidentStateTransition,
} from '../types/observability';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface IncidentLogProps {
  incidents: IncidentLogEntry[];
  openCount: number;
  recoverCount: number;
  resolvedCount: number;
  onDismiss: (id: string) => void;
  onClearDismissed: () => void;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function formatIso(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return iso;
  }
}

function formatDuration(startIso: string, endIso?: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    const totalSec = Math.floor(diffMs / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } catch {
    return '—';
  }
}

function formatErrorRate(rate?: number): string {
  if (rate === undefined) return '—';
  return `${(rate * 100).toFixed(1)} %`;
}

// ─── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: IncidentLifecycleStatus }) {
  const cfg = {
    open: {
      label: 'OPEN',
      cls: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
      dot: 'bg-rose-500 animate-pulse',
    },
    recovering: {
      label: 'RECOVERING',
      cls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
      dot: 'bg-amber-500 animate-pulse',
    },
    resolved: {
      label: 'RESOLVED',
      cls: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
      dot: 'bg-emerald-500',
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${cfg.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Severity chip ─────────────────────────────────────────────────────────────

function SeverityChip({ severity }: { severity: 'WARNING' | 'CRITICAL' }) {
  return severity === 'CRITICAL' ? (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
      CRITICAL
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
      WARNING
    </span>
  );
}

// ─── Trigger badge ─────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<IncidentTrigger, string> = {
  circuit_breaker:   'Circuit Breaker',
  high_null_rate:    'High NULL Rate',
  schema_drift:      'Schema Drift',
  low_throughput:    'Low Throughput',
  high_latency:      'High Latency',
  manual_quarantine: 'Manual Quarantine',
};

function TriggerBadge({ trigger }: { trigger: IncidentTrigger }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
      {TRIGGER_LABELS[trigger]}
    </span>
  );
}

// ─── State transition timeline ─────────────────────────────────────────────────

function TransitionTimeline({ history }: { history: IncidentStateTransition[] }) {
  const STATE_CFG = {
    OPEN: { label: 'OPEN', color: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', Icon: AlertTriangle },
    HALF_OPEN: { label: 'HALF-OPEN', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', Icon: RefreshCw },
    CLOSED: { label: 'CLOSED', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', Icon: CheckCircle2 },
  };

  return (
    <div className="flex flex-col gap-0 relative ml-2">
      {/* Vertical connector line */}
      {history.length > 1 && (
        <div className="absolute left-[5px] top-3 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />
      )}

      {history.map((t, idx) => {
        const cfg = STATE_CFG[t.toState];
        const Icon = cfg.Icon;
        return (
          <div key={idx} className="flex items-start gap-3 relative py-1">
            <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 z-10 ${cfg.dot}`} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-bold ${cfg.color}`}>
                  <Icon className="w-3 h-3 inline mr-1" />
                  {cfg.label}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {formatIso(t.at)}
                </span>
                {t.errorRate !== undefined && (
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    err: {formatErrorRate(t.errorRate)}
                  </span>
                )}
              </div>
              {t.message && (
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-tight">
                  {t.message}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Single incident row ────────────────────────────────────────────────────────

function IncidentRow({
  incident,
  onDismiss,
}: {
  incident: IncidentLogEntry;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const duration = formatDuration(incident.pausedAt, incident.resumedAt);
  const isActive = incident.status !== 'resolved';

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all duration-200 ${
        incident.status === 'open'
          ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/10'
          : incident.status === 'recovering'
          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10'
          : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/30'
      }`}
    >
      {/* ── Summary row (always visible) ────────────────────────────────── */}
      <div className="flex items-start gap-3 p-3">
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {incident.status === 'open' ? (
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          ) : incident.status === 'recovering' ? (
            <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '2s' }} />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Top row: badges + cause */}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip status={incident.status} />
            <SeverityChip severity={incident.severity} />
            <span className="text-[10px] font-mono font-semibold text-sky-700 dark:text-sky-300 uppercase">
              {incident.nodeId}
            </span>
            <TriggerBadge trigger={incident.trigger} />
          </div>

          {/* Cause headline */}
          <p className="text-xs font-sans font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            {incident.cause}
          </p>

          {/* Timing row */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Paused: {formatIso(incident.pausedAt)}
            </span>
            {incident.resumedAt ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Resumed: {formatIso(incident.resumedAt)}
              </span>
            ) : incident.recoveryStartedAt ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <RefreshCw className="w-3 h-3" />
                Recovery: {formatIso(incident.recoveryStartedAt)}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {isActive ? `Ongoing: ${duration}` : `Duration: ${duration}`}
            </span>
            {incident.errorRateAtPause !== undefined && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Err rate: {formatErrorRate(incident.errorRateAtPause)}
              </span>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => onDismiss(incident.id)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Dismiss incident"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Expanded details panel ───────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-950/40 px-4 py-3 flex flex-col gap-4">
          {/* Technical details */}
          <div className="flex flex-col gap-1">
            <h4 className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Technical Details
            </h4>
            <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
              {incident.details}
            </p>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCell
              label="Paused At"
              value={formatIso(incident.pausedAt)}
            />
            <MetricCell
              label="Resumed At"
              value={incident.resumedAt ? formatIso(incident.resumedAt) : '—'}
              highlight={!!incident.resumedAt}
            />
            <MetricCell
              label="Total Duration"
              value={duration}
            />
            <MetricCell
              label="State Transitions"
              value={String(incident.stateHistory.length)}
            />
            <MetricCell
              label="Error Rate (Pause)"
              value={formatErrorRate(incident.errorRateAtPause)}
              isError
            />
            <MetricCell
              label="Error Rate (Resume)"
              value={formatErrorRate(incident.errorRateAtResume)}
              highlight={incident.errorRateAtResume !== undefined}
            />
            {incident.dlqCount !== undefined && (
              <MetricCell
                label="DLQ Records"
                value={String(incident.dlqCount)}
                isError
              />
            )}
            <MetricCell
              label="Affected Node"
              value={incident.nodeId.toUpperCase()}
            />
          </div>

          {/* State transition history */}
          <div className="flex flex-col gap-1.5">
            <h4 className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              State Transition History
            </h4>
            <TransitionTimeline history={incident.stateHistory} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Metric cell sub-component ─────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  highlight = false,
  isError = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  isError?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
      <span className="text-[9px] font-mono font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`text-[11px] font-mono font-bold ${
          isError
            ? 'text-rose-600 dark:text-rose-400'
            : highlight
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

const SELECT_CLS =
  'text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ' +
  'text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500';

// ─── Main component ────────────────────────────────────────────────────────────

export const IncidentLog: React.FC<IncidentLogProps> = ({
  incidents,
  openCount,
  recoverCount,
  resolvedCount,
  onDismiss,
  onClearDismissed,
}) => {
  const [filter, setFilter] = useState<IncidentLogFilter>({
    status:  'all',
    nodeId:  'all',
    trigger: 'all',
  });

  const visible = useMemo(() => {
    return incidents.filter(inc => {
      if (inc.dismissed) return false;
      if (filter.status  !== 'all' && inc.status  !== filter.status)  return false;
      if (filter.nodeId  !== 'all' && inc.nodeId  !== filter.nodeId)  return false;
      if (filter.trigger !== 'all' && inc.trigger !== filter.trigger) return false;
      return true;
    });
  }, [incidents, filter]);

  const hasFilters =
    filter.status !== 'all' || filter.nodeId !== 'all' || filter.trigger !== 'all';
  const dismissedCount = incidents.filter(i => i.dismissed).length;

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl backdrop-blur-md flex flex-col gap-0 overflow-hidden transition-colors">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                Incident Log
              </h2>
              {openCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                  {openCount} OPEN
                </span>
              )}
              {recoverCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-white">
                  {recoverCount} RECOVERING
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {visible.length} of {incidents.filter(i => !i.dismissed).length} incidents shown
              {resolvedCount > 0 && ` · ${resolvedCount} resolved`}
            </p>
          </div>
        </div>

        {dismissedCount > 0 && (
          <button
            onClick={onClearDismissed}
            className="text-[11px] font-mono text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex-shrink-0"
            title={`Clear ${dismissedCount} dismissed`}
          >
            Clear {dismissedCount} dismissed
          </button>
        )}
      </div>

      {/* ── KPI summary bar ────────────────────────────────────────────────── */}
      <div className="flex divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
        {[
          { label: 'Open', count: openCount,     color: 'text-rose-600 dark:text-rose-400'    },
          { label: 'Recovering', count: recoverCount,  color: 'text-amber-600 dark:text-amber-400'  },
          { label: 'Resolved', count: resolvedCount, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total', count: incidents.filter(i => !i.dismissed).length, color: 'text-slate-700 dark:text-slate-300' },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex-1 flex flex-col items-center py-2 px-3">
            <span className={`text-base font-bold font-mono ${color}`}>{count}</span>
            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
        </div>

        <select
          value={filter.status}
          onChange={e =>
            setFilter(prev => ({
              ...prev,
              status: e.target.value as IncidentLifecycleStatus | 'all',
            }))
          }
          className={SELECT_CLS}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="recovering">Recovering</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          value={filter.nodeId}
          onChange={e =>
            setFilter(prev => ({
              ...prev,
              nodeId: e.target.value as CircuitBreakerNodeId | 'all',
            }))
          }
          className={SELECT_CLS}
        >
          <option value="all">All Nodes</option>
          <option value="ingest">INGEST</option>
          <option value="process">PROCESS</option>
          <option value="serve">SERVE</option>
        </select>

        <select
          value={filter.trigger}
          onChange={e =>
            setFilter(prev => ({
              ...prev,
              trigger: e.target.value as IncidentTrigger | 'all',
            }))
          }
          className={SELECT_CLS}
        >
          <option value="all">All Triggers</option>
          <option value="circuit_breaker">Circuit Breaker</option>
          <option value="high_null_rate">High NULL Rate</option>
          <option value="schema_drift">Schema Drift</option>
          <option value="low_throughput">Low Throughput</option>
          <option value="high_latency">High Latency</option>
          <option value="manual_quarantine">Manual Quarantine</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => setFilter({ status: 'all', nodeId: 'all', trigger: 'all' })}
            className="text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Incident list ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60 dark:text-emerald-500/40" />
            <div>
              <p className="text-sm font-sans font-semibold text-slate-500 dark:text-slate-400">
                {incidents.filter(i => !i.dismissed).length === 0
                  ? 'No incidents recorded'
                  : 'No incidents match the current filters'}
              </p>
              <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                {incidents.filter(i => !i.dismissed).length === 0
                  ? 'Use the Incident Simulator or fire a live circuit-breaker event to generate entries.'
                  : 'Try clearing the active filters to see all incidents.'}
              </p>
            </div>
          </div>
        ) : (
          visible.map(inc => (
            <IncidentRow key={inc.id} incident={inc} onDismiss={onDismiss} />
          ))
        )}
      </div>
    </div>
  );
};
