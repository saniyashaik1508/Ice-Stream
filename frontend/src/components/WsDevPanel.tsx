/**
 * IceStream — WsDevPanel (DEV mode only)
 *
 * A collapsible control panel rendered only when `import.meta.env.DEV` is true.
 * Lets you fire mock circuit-breaker WebSocket events directly from the UI —
 * no browser DevTools console needed — so you can see the full pipeline:
 *
 *   Button click
 *     → wsDevMock.fireCircuitBreaker()
 *         → _cbListeners (same path as a real WS message)
 *             → useWebSocketAlerts.handleCircuitBreaker()
 *                 → liveAlerts updated
 *                 → justChangedNodes set
 *                     → Dashboard nodes useMemo resolves new status
 *                         → PipelineNode turns red + flash ring
 *                     → Dashboard edges useMemo resolves new color
 *                         → edges turn red instantly
 *                 → lastEvent set
 *                     → LiveAlertBanner appears
 *
 * This component is stripped from production builds by Vite's tree-shaking
 * because it is only rendered under `import.meta.env.DEV && <WsDevPanel />`.
 */

import React, { useState } from 'react';
import { Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { wsDevMock } from '../services/websocketService';

type NodeTarget = 'ingest' | 'process' | 'serve';
type BreakerState = 'OPEN' | 'HALF_OPEN' | 'CLOSED';

const NODE_OPTIONS: NodeTarget[] = ['ingest', 'process', 'serve'];

const STATE_CONFIGS: Record<BreakerState, { label: string; className: string }> = {
  OPEN: {
    label: '🔴 OPEN (circuit tripped)',
    className:
      'bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500 text-white',
  },
  HALF_OPEN: {
    label: '🟡 HALF-OPEN (probing)',
    className:
      'bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 text-white',
  },
  CLOSED: {
    label: '🟢 CLOSED (recover)',
    className:
      'bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
  },
};

export const WsDevPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeTarget>('process');
  const [errorRate, setErrorRate] = useState(0.07);
  const [lastFired, setLastFired] = useState<string | null>(null);

  const fire = (state: BreakerState) => {
    wsDevMock.fireCircuitBreaker(state, selectedNode, state === 'CLOSED' ? 0 : errorRate);
    setLastFired(`${selectedNode.toUpperCase()} → ${state}  (err ${(errorRate * 100).toFixed(0)}%)`);
  };

  return (
    <div className="border border-dashed border-amber-400/60 dark:border-amber-500/40 rounded-2xl overflow-hidden bg-amber-50/50 dark:bg-amber-950/20 transition-colors">

      {/* Header / Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 tracking-wide uppercase">
          <Zap className="w-3.5 h-3.5" />
          DEV — WebSocket Mock Event Panel
          <span className="text-[10px] font-normal text-amber-600/70 dark:text-amber-500/60 normal-case">
            (only visible in Vite dev mode)
          </span>
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-amber-200/60 dark:border-amber-600/20 pt-4">

          {/* Instructions */}
          <p className="text-[11px] font-mono text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
            Fire mock circuit-breaker events through the same code path as real Kafka
            messages. The node turns red/amber and edges recolor instantly — no backend
            required.
          </p>

          {/* Node + Error Rate Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Target node */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Target Node
              </label>
              <div className="flex gap-1">
                {NODE_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setSelectedNode(n)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors border
                      ${selectedNode === n
                        ? 'bg-sky-500 text-white border-sky-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-400'
                      }`}
                  >
                    {n.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Error rate slider */}
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Error Rate: <span className="text-slate-700 dark:text-slate-200 font-bold">{(errorRate * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={errorRate}
                onChange={e => setErrorRate(Number(e.target.value))}
                className="w-full accent-rose-500 h-1.5"
              />
            </div>
          </div>

          {/* Fire Buttons */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(STATE_CONFIGS) as [BreakerState, typeof STATE_CONFIGS[BreakerState]][]).map(
              ([state, cfg]) => (
                <button
                  key={state}
                  onClick={() => fire(state)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors shadow-sm ${cfg.className}`}
                >
                  {cfg.label}
                </button>
              )
            )}
          </div>

          {/* Last fired */}
          {lastFired && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <Zap className="w-3 h-3 text-rose-500 shrink-0" />
              Last fired: <span className="font-semibold text-slate-700 dark:text-slate-200">{lastFired}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
