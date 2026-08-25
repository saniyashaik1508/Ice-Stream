/**
 * IceStream — Alert Detail Modal/Drawer
 *
 * Shows full detail for a selected alert including rule metadata,
 * column info, expected vs actual vs threshold, severity, status,
 * timestamps, and description.
 */

import React from 'react';
import { ObservabilityAlert, AlertSeverity, AlertStatus } from '../types/observability';
import { X, AlertOctagon, AlertTriangle, Info, Clock, Tag } from 'lucide-react';

interface AlertDetailProps {
  alert: ObservabilityAlert;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

function getSeverityConfig(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return {
        icon: AlertOctagon,
        label: 'CRITICAL',
        bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30',
        text: 'text-rose-700 dark:text-rose-300',
        dot: 'bg-rose-500',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        label: 'WARNING',
        bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
      };
    default:
      return {
        icon: Info,
        label: 'INFO',
        bg: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30',
        text: 'text-sky-700 dark:text-sky-300',
        dot: 'bg-sky-500',
      };
  }
}

function getStatusBadge(status: AlertStatus) {
  switch (status) {
    case 'active':
      return 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30';
    case 'acknowledged':
      return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30';
    case 'resolved':
      return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30';
  }
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}
const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b border-slate-100 dark:border-slate-800/80 last:border-0">
    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider w-28 flex-shrink-0">
      {label}
    </span>
    <span className="text-xs font-mono text-slate-800 dark:text-slate-200 font-semibold">
      {value}
    </span>
  </div>
);

export const AlertDetail: React.FC<AlertDetailProps> = ({
  alert,
  onClose,
  onAcknowledge,
  onResolve,
}) => {
  const { anomaly } = alert;
  const sevCfg = getSeverityConfig(anomaly.severity);
  const SevIcon = sevCfg.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl dark:shadow-black/40 w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className={`flex items-start justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800 rounded-t-2xl ${sevCfg.bg}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${sevCfg.bg} border ${sevCfg.bg.split(' ')[1]}`}>
              <SevIcon className={`w-5 h-5 ${sevCfg.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${sevCfg.bg} ${sevCfg.text}`}>
                  {sevCfg.label}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getStatusBadge(anomaly.status)}`}>
                  {anomaly.status.toUpperCase()}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1 font-sans">
                Data Quality Incident
              </h2>
              <p className={`text-xs font-mono font-semibold mt-0.5 ${sevCfg.text}`}>
                {anomaly.ruleName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-2">
          <DetailRow label="Rule" value={anomaly.ruleName} />
          <DetailRow label="Node" value={<span className="text-sky-700 dark:text-sky-300 uppercase">{anomaly.nodeId}</span>} />
          {anomaly.column && <DetailRow label="Column" value={<code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">{anomaly.column}</code>} />}
          {anomaly.expectedValue !== undefined && <DetailRow label="Expected" value={String(anomaly.expectedValue)} />}
          {anomaly.actualValue !== undefined && (
            <DetailRow
              label="Actual"
              value={<span className={sevCfg.text}>{String(anomaly.actualValue)}</span>}
            />
          )}
          {anomaly.threshold !== undefined && <DetailRow label="Threshold" value={String(anomaly.threshold)} />}

          <DetailRow
            label="Detected"
            value={
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {anomaly.detectedAt}
              </span>
            }
          />
          {alert.acknowledgedAt && <DetailRow label="Acknowledged" value={alert.acknowledgedAt} />}
          {alert.resolvedAt && <DetailRow label="Resolved" value={alert.resolvedAt} />}

          {/* Description */}
          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              <Tag className="w-3 h-3" />
              Description
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {anomaly.description}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex flex-wrap gap-2">
          {anomaly.status === 'active' && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="flex-1 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
            >
              Acknowledge
            </button>
          )}
          {(anomaly.status === 'active' || anomaly.status === 'acknowledged') && (
            <button
              onClick={() => onResolve(alert.id)}
              className="flex-1 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
            >
              Mark Resolved
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-mono font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
