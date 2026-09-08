/**
 * IceStream — WsStatusIndicator
 *
 * A compact indicator that shows the live WebSocket connection status.
 * Placed inside PipelineHeader so it's always visible.
 *
 *  ● green  pulse  = connected
 *  ● amber  pulse  = connecting
 *  ● red    static = error
 *  ● slate  static = disconnected
 */

import React from 'react';
import { WsConnectionStatus } from '../services/websocketService';

interface WsStatusIndicatorProps {
  status: WsConnectionStatus;
  /** Optional: show text label next to the dot */
  showLabel?: boolean;
}

const CONFIG: Record<
  WsConnectionStatus,
  { dot: string; pulse: boolean; label: string }
> = {
  connected: {
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    pulse: true,
    label: 'Live',
  },
  connecting: {
    dot: 'bg-amber-400 dark:bg-amber-300',
    pulse: true,
    label: 'Connecting…',
  },
  error: {
    dot: 'bg-rose-500 dark:bg-rose-400',
    pulse: false,
    label: 'WS Error',
  },
  disconnected: {
    dot: 'bg-slate-400 dark:bg-slate-500',
    pulse: false,
    label: 'Offline',
  },
};

export const WsStatusIndicator: React.FC<WsStatusIndicatorProps> = ({
  status,
  showLabel = false,
}) => {
  const cfg = CONFIG[status];

  return (
    <span
      className="flex items-center gap-1.5"
      title={`WebSocket: ${cfg.label}`}
      aria-label={`WebSocket status: ${cfg.label}`}
    >
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${cfg.dot}`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`}
        />
      </span>
      {showLabel && (
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
          {cfg.label}
        </span>
      )}
    </span>
  );
};
