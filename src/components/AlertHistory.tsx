/**
 * IceStream — Alert History Table
 *
 * Tabular view of all alerts (active, acknowledged, resolved).
 * Supports filtering by severity, status, and node.
 */

import React, { useState, useMemo } from 'react';
import { History, Filter } from 'lucide-react';
import { ObservabilityAlert, AlertHistoryFilter, AlertSeverity, AlertStatus } from '../types/observability';

interface AlertHistoryProps {
  history: ObservabilityAlert[];
  onViewDetails: (alertId: string) => void;
}

const SEVERITY_OPTIONS: Array<{ value: AlertSeverity | 'all'; label: string }> = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

const STATUS_OPTIONS: Array<{ value: AlertStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];

const NODE_OPTIONS = [
  { value: 'all' as const, label: 'All Nodes' },
  { value: 'ingest' as const, label: 'INGEST' },
  { value: 'process' as const, label: 'PROCESS' },
  { value: 'serve' as const, label: 'SERVE' },
];

function severityChip(s: AlertSeverity) {
  switch (s) {
    case 'critical':
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">CRITICAL</span>;
    case 'warning':
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">WARNING</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30">INFO</span>;
  }
}

function statusChip(s: AlertStatus) {
  switch (s) {
    case 'active':
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">ACTIVE</span>;
    case 'acknowledged':
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">ACK'D</span>;
    case 'resolved':
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">RESOLVED</span>;
  }
}

const SELECT_CLS = "text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500";

export const AlertHistory: React.FC<AlertHistoryProps> = ({ history, onViewDetails }) => {
  const [filter, setFilter] = useState<AlertHistoryFilter>({
    severity: 'all',
    status: 'all',
    nodeId: 'all',
  });

  const filtered = useMemo(() => {
    return history.filter(a => {
      const { anomaly } = a;
      if (filter.severity !== 'all' && anomaly.severity !== filter.severity) return false;
      if (filter.status !== 'all' && anomaly.status !== filter.status) return false;
      if (filter.nodeId !== 'all' && anomaly.nodeId !== filter.nodeId) return false;
      return true;
    });
  }, [history, filter]);

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl backdrop-blur-md flex flex-col gap-3 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
          <History className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
            Alert History
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {filtered.length} of {history.length} records shown
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
        </div>
        <select
          value={filter.severity}
          onChange={e => setFilter(prev => ({ ...prev, severity: e.target.value as AlertSeverity | 'all' }))}
          className={SELECT_CLS}
        >
          {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filter.status}
          onChange={e => setFilter(prev => ({ ...prev, status: e.target.value as AlertStatus | 'all' }))}
          className={SELECT_CLS}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filter.nodeId}
          onChange={e => setFilter(prev => ({ ...prev, nodeId: e.target.value as AlertHistoryFilter['nodeId'] }))}
          className={SELECT_CLS}
        >
          {NODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(filter.severity !== 'all' || filter.status !== 'all' || filter.nodeId !== 'all') && (
          <button
            onClick={() => setFilter({ severity: 'all', status: 'all', nodeId: 'all' })}
            className="text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-6 text-[12px] font-mono text-slate-400 dark:text-slate-500">
          {history.length === 0 ? 'No alerts recorded yet. Use the Incident Simulator to generate alerts.' : 'No alerts match the current filters.'}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-[11px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                {['Time', 'Severity', 'Rule', 'Node', 'Actual', 'Threshold', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(alert => {
                const { anomaly } = alert;
                return (
                  <tr
                    key={alert.id}
                    className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {alert.createdAt}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {severityChip(anomaly.severity)}
                    </td>
                    <td className="py-2 px-2 text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                      {anomaly.ruleName}
                    </td>
                    <td className="py-2 px-2 text-sky-700 dark:text-sky-300 font-semibold uppercase whitespace-nowrap">
                      {anomaly.nodeId}
                    </td>
                    <td className={`py-2 px-2 font-semibold whitespace-nowrap ${
                      anomaly.severity === 'critical' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {anomaly.actualValue !== undefined ? String(anomaly.actualValue) : '—'}
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {anomaly.threshold !== undefined ? String(anomaly.threshold) : '—'}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {statusChip(anomaly.status)}
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => onViewDetails(alert.id)}
                        className="text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
