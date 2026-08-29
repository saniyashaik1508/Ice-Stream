/**
 * IceStream — DetectionCheck Panel
 *
 * Appears immediately when an incident scenario injects bad data, showing
 * a real-time detection timeline:
 *   [Injected] ? [Flink Detected] ? [Alert Raised]
 *
 * Driven by DetectionEvent emitted from useObservability on scenario activation.
 */

import React from "react";
import {
  ShieldCheck,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
} from "lucide-react";
import { DetectionEvent } from "../types/observability";

interface DetectionCheckProps {
  event: DetectionEvent | null;
  onDismiss: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  ingest: "INGEST (Kafka)",
  process: "PROCESS (Flink)",
  serve: "SERVE (Iceberg)",
};

const SEVERITY_STYLES = {
  critical: {
    banner: "border-rose-400/60 dark:border-rose-500/50 bg-rose-50/80 dark:bg-rose-950/40",
    icon: "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30",
    badge: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30",
    dot: "bg-rose-500",
    title: "text-rose-700 dark:text-rose-300",
  },
  warning: {
    banner: "border-amber-400/60 dark:border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/40",
    icon: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30",
    badge: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
    dot: "bg-amber-500",
    title: "text-amber-700 dark:text-amber-300",
  },
  info: {
    banner: "border-sky-400/60 dark:border-sky-500/50 bg-sky-50/80 dark:bg-sky-950/40",
    icon: "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30",
    badge: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30",
    dot: "bg-sky-500",
    title: "text-sky-700 dark:text-sky-300",
  },
};

interface TimelineStepProps {
  icon: React.ElementType;
  label: string;
  detail: string;
  time: string;
  done: boolean;
  isLast?: boolean;
}

const TimelineStep: React.FC<TimelineStepProps> = ({
  icon: Icon,
  label,
  detail,
  time,
  done,
  isLast,
}) => (
  <div className="flex items-start gap-2 flex-1 min-w-0">
    <div className="flex flex-col items-center">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center border shrink-0 transition-all ${
          done
            ? "bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      {!isLast && (
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mt-1" />
      )}
    </div>
    <div className="flex-1 min-w-0 pb-2">
      <p className={`text-[11px] font-mono font-semibold truncate ${done ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>
        {label}
      </p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{detail}</p>
      {time && (
        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{time}</p>
      )}
    </div>
  </div>
);

export const DetectionCheck: React.FC<DetectionCheckProps> = ({ event, onDismiss }) => {
  if (!event) return null;

  const styles = SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.info;
  const stageLabel = STAGE_LABELS[event.detectedAtStage] ?? event.detectedAtStage.toUpperCase();

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm dark:shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${styles.banner}`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg border shrink-0 ${styles.icon}`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm font-bold font-sans ${styles.title}`}>
                Detection Check
              </h2>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide animate-pulse ${styles.badge}`}
              >
                {event.severity === "critical" ? "?? CRITICAL" : event.severity === "warning" ? "?? WARNING" : "?? INFO"}
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Detected in &lt; {event.detectionLatencyMs}ms
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono mt-0.5">
              <span className="font-semibold">{event.ruleName}</span>
              {" — "}bad data flagged at {stageLabel}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Metric breach row */}
      <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
        {event.column && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            field: <strong>{event.column}</strong>
          </span>
        )}
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          expected: <strong>{event.expectedValue}</strong>
        </span>
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${styles.badge}`}>
          actual: {event.actualValue}
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          threshold: {event.threshold}
        </span>
      </div>

      {/* Detection Timeline */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 p-3">
        <p className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
          Detection Timeline
        </p>
        <div className="flex flex-col gap-0">
          <TimelineStep
            icon={Zap}
            label="Bad Data Injected"
            detail={`Source: E-Commerce Generator ? ${event.injectedAt}`}
            time={event.injectedAt}
            done
          />
          <TimelineStep
            icon={AlertTriangle}
            label={`Flagged by Flink Processor`}
            detail={`Rule: ${event.ruleName} · Breach: ${event.actualValue} (threshold ${event.threshold})`}
            time={event.detectedAt}
            done
          />
          <TimelineStep
            icon={CheckCircle2}
            label="Alert Raised & Logged"
            detail={`Severity: ${event.severity.toUpperCase()} · Stage: ${stageLabel}`}
            time={event.alertRaisedAt}
            done
            isLast
          />
        </div>
      </div>
    </div>
  );
};
