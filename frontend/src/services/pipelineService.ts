/**
 * IceStream — Pipeline Service
 *
 * Abstraction layer for pipeline status data.
 * Currently uses mock data; swap the implementation inside each function
 * to connect to the real FastAPI backend at http://localhost:8000.
 *
 * Future real implementation:
 *   const res = await fetch('/api/pipeline/status');
 *   return res.json();
 */

import { PipelineStatusApiResponse } from '../types/pipeline';

const PIPELINE_STATUS_ENDPOINT = '/api/pipeline/status';

/** GET /api/pipeline/status */
export async function getPipelineStatus(): Promise<PipelineStatusApiResponse> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // Replace the block below with a real fetch() once the backend is live:
  //
  // const res = await fetch(PIPELINE_STATUS_ENDPOINT);
  // if (!res.ok) throw new Error(`Pipeline status fetch failed: ${res.status}`);
  // return res.json();
  // ─────────────────────────────────────────────────────────────────────────
  void PIPELINE_STATUS_ENDPOINT; // acknowledge unused var until real API is wired
  return Promise.resolve({
    ingest: { status: 'healthy', eventsPerSecond: 2450, latencyMs: 120, errorRatePct: 0.02 },
    process: { status: 'healthy', eventsPerSecond: 2380, latencyMs: 145, errorRatePct: 0.01 },
    serve: { status: 'healthy', eventsPerSecond: 2310, latencyMs: 170, errorRatePct: 0.00 },
  });
}
