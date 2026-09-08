/**
 * IceStream — LiveAlertBanner
 *
 * A slim, auto-dismissible banner that appears at the top of the dashboard
 * when a live circuit-breaker event arrives over WebSocket.
 *
 * Separate from the existing DetectionCheck panel (which is scenario-driven).
 * This banner is driven purely by the real WebSocket feed.
 *
 * Layout:
 *   [⚡ icon]  [node] circuit breaker [STATUS]  ·  [message]  [error rate]  [×]
 */

import React, { useEffect, useState } from 'react';
import { Zap, X, Wifi, WifiOff } from 'lucide-react';
import { CircuitBreakerEvent } from '../types/observability';

interface LiveAlertBannerProps {
  event: CircuitBreakerEvent | null;
  onDismiss: () => void;
}

const STATUS_STYLES = {
  CRITICAL: {
    wrapper:
      'border-rose-400/60 dark:border-rose-500/50 bg-rose-50/90 dark:bg-rose-950/50',
    badge:
      'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
    icon: 'text-rose-600 dark:text-rose-400',
    text: 'text-rose-800 dark:text-rose-200',
  },
  WARNING: {
    wrapper:
      'border-amber-400/60 dark:border-amber-500/50 bg-amber-50/90 dark:bg-amber-950/50',
    badge:
      'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-800 dark:text-amber-200',
  },
  INFO: {
    wrapper:
      'border-emerald-400/60 dark:border-emerald-500/50 bg-emerald-50/90 dark:bg-emerald-950/50',
    badge:
      'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-800 dark:text-emerald-200',
  },
};

const STATUS_LABELS: Record<string, string> = {
  OPEN:      '🔴 OPEN',
  HALF_OPEN: '🟡 HALF-OPEN',
  CLOSED:    '🟢 CLOSED',
};

export const LiveAlertBanner: React.FC<LiveAlertBannerProps> = ({
  event,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  // Show banner whenever a new event arrives; auto-dismiss after 8s for CLOSED events
  useEffect(() => {
    if (!event) {
      setVisible(false);
      return;
    }
    setVisible(true);

    // Circuit CLOSED restores healthy — auto-dismiss after 8 s
    if (event.status === 'CLOSED') {
      const t = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 8000);
      return () => clearTimeout(t);
    }
  }, [event, onDismiss]);

  if (!event || !visible) return null;

  const styles = STATUS_STYLES[event.severity] ?? STATUS_STYLES.INFO;
  const isOpen  = event.status === 'OPEN';
  const Icon    = isOpen ? WifiOff : Wifi;
  const time    = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div
      role="alert"
      className={`
        flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm
        backdrop-blur-md transition-all duration-300
        ${styles.wrapper}
      `}
    >
      {/* Icon */}
      <div className={`shrink-0 ${styles.icon}`}>
        {isOpen ? (
          <Zap className="w-4 h-4" />
        ) : (
          <Icon className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Source label */}
        <span
          className={`text-[11px] font-mono font-bold uppercase tracking-wide ${styles.text}`}
        >
          ⚡ LIVE — {event.nodeId.toUpperCase()} circuit breaker
        </span>

        {/* Status badge */}
        <span
          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${styles.badge}`}
        >
          {STATUS_LABELS[event.status] ?? event.status}
        </span>

        {/* Message */}
        <span className={`text-[11px] font-mono truncate ${styles.text} opacity-80`}>
          {event.message}
        </span>

        {/* Error rate pill (only when non-zero) */}
        {event.errorRate !== undefined && event.errorRate > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            err {(event.errorRate * 100).toFixed(1)}%
          </span>
        )}

        {/* Timestamp */}
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 ml-auto shrink-0">
          {time}
        </span>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => { setVisible(false); onDismiss(); }}
        className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Dismiss"
        aria-label="Dismiss live alert banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
