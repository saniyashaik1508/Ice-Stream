/**
 * IceStream — Active Alert Panel
 *
 * Displays currently active and acknowledged alerts with severity icons,
 * acknowledge and view-details actions. Driven entirely by prop state.
 */

import React from 'react';
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  Eye,
  CheckCheck,
} from 'lucide-react';
import { ObservabilityAlert, AlertSeverity } from '../types/observability';

interface AlertPanelProps {
  alerts: ObservabilityAlert[];
  onViewDetails: (alertId: string) => void;
  onAcknowledge: (alertId: string) => void;
}

function getSeverityIcon(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return <AlertOctagon className="w-4 h-4 text-rose-500 dark:text-rose-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
    default:
      return <Info className="w-4 h-4 text-sky-500 dark:text-sky-400" />;
  }
}

function getSeverityBadge(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30';
    case 'warning':
      return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30';
    default:
      return 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30';
  }
}

function getAlertBorder(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'border-l-rose-500 dark:border-l-rose-400';
    case 'warning':
      return 'border-l-amber-500 dark:border-l-amber-400';
    default:
      return 'border-l-sky-500 dark:border-l-sky-400';
  }
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  onViewDetails,
  onAcknowledge,
}) => {
  const activeAlerts = alerts.filter(a => a.anomaly.status === 'active');
  const acknowledgedAlerts = alerts.filter(a => a.anomaly.status === 'acknowledged');

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl backdrop-blur-md flex flex-col gap-3 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
              Active Alerts
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {activeAlerts.length} unacknowledged · {acknowledgedAlerts.length} acknowledged
            </p>
          </div>
        </div>

        {alerts.length > 0 && (
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-rose-500 text-white">
            {alerts.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-500">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 dark:text-emerald-500" />
          <p className="text-xs font-mono">✓ No active alerts</p>
          <p className="text-[11px] font-mono text-slate-400 dark:text-slate-600">Pipeline is operating normally</p>
        </div>
      )}

      {/* Alert List */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map(alert => {
            const { anomaly } = alert;
            const isAcknowledged = anomaly.status === 'acknowledged';
            return (
              <div
                key={alert.id}
                className={`flex flex-col gap-2 p-3 rounded-xl border border-l-4 bg-slate-50 dark:bg-slate-950/60 transition-all duration-200 ${
                  getAlertBorder(anomaly.severity)
                } ${isAcknowledged ? 'opacity-60' : ''} border-slate-200 dark:border-slate-800`}
              >
                {/* Alert Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(anomaly.severity)}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getSeverityBadge(anomaly.severity)}`}
                        >
                          {anomaly.severity.toUpperCase()}
                        </span>
                        {isAcknowledged && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            ACKNOWLEDGED
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-sans">
                        {anomaly.ruleName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metric Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="flex flex-col">
                    <span className="text-slate-400 dark:text-slate-500 uppercase text-[10px]">Node</span>
                    <span className="text-sky-700 dark:text-sky-300 font-semibold uppercase">{anomaly.nodeId}</span>
                  </div>
                  {anomaly.actualValue !== undefined && (
                    <div className="flex flex-col">
                      <span className="text-slate-400 dark:text-slate-500 uppercase text-[10px]">Actual</span>
                      <span className={`font-semibold ${anomaly.severity === 'critical' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {String(anomaly.actualValue)}
                      </span>
                    </div>
                  )}
                  {anomaly.threshold !== undefined && (
                    <div className="flex flex-col">
                      <span className="text-slate-400 dark:text-slate-500 uppercase text-[10px]">Threshold</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{String(anomaly.threshold)}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-slate-400 dark:text-slate-500 uppercase text-[10px]">Detected</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{anomaly.detectedAt}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1.5 mt-1">
                  <button
                    onClick={() => onViewDetails(alert.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    View Details
                  </button>
                  {anomaly.status === 'active' && (
                    <button
                      onClick={() => onAcknowledge(alert.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
