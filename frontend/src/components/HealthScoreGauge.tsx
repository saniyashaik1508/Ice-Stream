/**
 * IceStream — HealthScoreGauge Component
 *
 * Displays the composite health score (0–100) as a circular arc gauge,
 * with per-stage bars and a grade badge. Used inside SelfHealingPanel.
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { HealthScore } from '../types/healing';

interface HealthScoreGaugeProps {
  score: HealthScore;
  compact?: boolean;
}

function gradeColor(grade: HealthScore['grade']): { ring: string; text: string; bg: string } {
  switch (grade) {
    case 'A': return { ring: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' };
    case 'B': return { ring: 'stroke-sky-500',     text: 'text-sky-600 dark:text-sky-400',         bg: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30' };
    case 'C': return { ring: 'stroke-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' };
    case 'D': return { ring: 'stroke-orange-500',  text: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30' };
    case 'F': return { ring: 'stroke-rose-500',    text: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30' };
  }
}

function stageBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-sky-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

function TrendIcon({ trend }: { trend: HealthScore['trend'] }) {
  if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (trend === 'degrading') return <TrendingDown className="w-3 h-3 text-rose-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

export const HealthScoreGauge: React.FC<HealthScoreGaugeProps> = ({ score, compact = false }) => {
  const { ring, text, bg } = gradeColor(score.grade);

  // SVG arc parameters
  const radius = 36;
  const cx = 44;
  const cy = 44;
  const circumference = 2 * Math.PI * radius;
  // Only use top 270° of the circle (start at 135°, end at 45°)
  const arcLength = circumference * 0.75;
  const filled = arcLength * (score.overall / 100);
  const gap = arcLength - filled;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${bg}`}>
        <Activity className={`w-3.5 h-3.5 ${text}`} />
        <span className={`text-sm font-bold font-mono ${text}`}>{score.overall}</span>
        <span className={`text-[10px] font-mono font-semibold ${text}`}>/ 100</span>
        <span className={`text-xs font-bold font-mono ${text}`}>{score.grade}</span>
        <TrendIcon trend={score.trend} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Circular gauge */}
      <div className="relative flex items-center justify-center">
        <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-[135deg]">
          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeLinecap="round"
          />
          {/* Foreground arc */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            strokeWidth="8"
            className={`${ring} transition-all duration-700`}
            strokeDasharray={`${filled} ${gap + circumference * 0.25}`}
            strokeLinecap="round"
          />
        </svg>
        {/* Center text */}
        <div className="absolute flex flex-col items-center leading-none">
          <span className={`text-xl font-bold font-mono ${text}`}>{score.overall}</span>
          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Grade badge + trend */}
      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-0.5 rounded-lg text-sm font-bold font-mono border ${bg} ${text}`}>
          Grade {score.grade}
        </span>
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
          <TrendIcon trend={score.trend} />
          <span className="capitalize">{score.trend}</span>
        </div>
      </div>

      {/* Per-stage bars */}
      <div className="w-full flex flex-col gap-1.5 min-w-[160px]">
        {[
          { label: 'INGEST',  value: score.ingest },
          { label: 'PROCESS', value: score.process },
          { label: 'SERVE',   value: score.serve },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 w-14 text-right">{label}</span>
            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stageBarColor(value)}`}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 w-6 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
