/**
 * IceStream — Observability Service
 *
 * Abstraction layer for rules, node details, and quarantine operations.
 *
 * Future real endpoints:
 *   GET  /api/observability/rules
 *   GET  /api/pipeline/{nodeId}/details
 *   POST /api/pipeline/{nodeId}/quarantine
 */

import { ObservabilityRule } from '../types/observability';
import { PipelineNodeData } from '../types/pipeline';
import { observabilityRules } from '../data/observabilityRules';
import { initialPipelineStages } from '../data/pipelineData';

const RULES_ENDPOINT = '/api/observability/rules';
const PIPELINE_ENDPOINT = '/api/pipeline';

/** GET /api/observability/rules */
export async function getObservabilityRules(): Promise<ObservabilityRule[]> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // const res = await fetch(RULES_ENDPOINT);
  // if (!res.ok) throw new Error(`Rules fetch failed: ${res.status}`);
  // return res.json();
  // ─────────────────────────────────────────────────────────────────────────
  void RULES_ENDPOINT;
  return Promise.resolve(observabilityRules);
}

/** GET /api/pipeline/{nodeId}/details */
export async function getNodeDetails(nodeId: string): Promise<PipelineNodeData | null> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // const res = await fetch(`${PIPELINE_ENDPOINT}/${nodeId}`);
  // if (!res.ok) return null;
  // return res.json();
  // ─────────────────────────────────────────────────────────────────────────
  void PIPELINE_ENDPOINT;
  return Promise.resolve(initialPipelineStages.find(s => s.id === nodeId) ?? null);
}

/** POST /api/pipeline/{nodeId}/quarantine */
export async function quarantineNode(nodeId: string, reason: string): Promise<void> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // await fetch(`${PIPELINE_ENDPOINT}/${nodeId}/quarantine`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ nodeId, reason }),
  // });
  // ─────────────────────────────────────────────────────────────────────────
  void nodeId;
  void reason;
  return Promise.resolve();
}
