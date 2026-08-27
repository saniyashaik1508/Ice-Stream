import { memo } from "react";
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "reactflow";

export interface FlowEdgeData {
  label?: string;
  blocked?: boolean;
  isDark?: boolean;
}

/**
 * FlowEdge — Custom React Flow edge with an HTML pill label rendered via
 * EdgeLabelRenderer. The label moves and scales with the canvas on zoom/pan.
 * Label sits ABOVE the midpoint of the arrow line, in the gap between nodes.
 */
export const FlowEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
  animated,
}: EdgeProps<FlowEdgeData>) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const label = data?.label;
  const blocked = data?.blocked ?? false;
  const isDark = data?.isDark ?? false;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        className={animated ? "animated" : ""}
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              // Centre horizontally on labelX, sit 14px ABOVE the edge line
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 14}px)`,
              pointerEvents: "none",
            }}
            className="nodrag nopan"
          >
            <div
              className={[
                "flex items-center gap-1 px-2 py-0.5 rounded-full",
                "text-[9px] font-mono font-semibold whitespace-nowrap",
                "shadow border",
                blocked
                  ? isDark
                    ? "bg-fuchsia-950/95 text-fuchsia-300 border-fuchsia-600/60"
                    : "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-300"
                  : isDark
                  ? "bg-slate-900/95 text-sky-300 border-slate-600/60"
                  : "bg-white/95 text-slate-600 border-slate-300/80",
              ].join(" ")}
            >
              {blocked && <span>&#x26D4;</span>}
              <span>{label}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

FlowEdge.displayName = "FlowEdge";
