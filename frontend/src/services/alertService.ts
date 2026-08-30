/**
 * IceStream — Alert Service
 *
 * Abstraction layer for alert CRUD operations.
 * All state is managed in useObservability hook; this service handles
 * the API transport layer only.
 *
 * Future real endpoints:
 *   GET  /api/alerts
 *   GET  /api/alerts/history
 *   POST /api/alerts/{id}/acknowledge
 *   POST /api/alerts/{id}/resolve
 */

import { ObservabilityAlert, AlertsApiResponse, AlertHistoryApiResponse } from '../types/observability';

const BASE = '/api/alerts';

/** GET /api/alerts — returns currently active + acknowledged alerts */
export async function getActiveAlerts(): Promise<ObservabilityAlert[]> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // const res = await fetch(BASE);
  // if (!res.ok) throw new Error(`Alerts fetch failed: ${res.status}`);
  // const data: AlertsApiResponse = await res.json();
  // return data.alerts;
  // ─────────────────────────────────────────────────────────────────────────
  void BASE;
  return Promise.resolve([]);
}

/** GET /api/alerts/history — paginated resolved + full history */
export async function getAlertHistory(): Promise<ObservabilityAlert[]> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // const res = await fetch(`${BASE}/history`);
  // if (!res.ok) throw new Error(`Alert history fetch failed: ${res.status}`);
  // const data: AlertHistoryApiResponse = await res.json();
  // return data.history;
  // ─────────────────────────────────────────────────────────────────────────
  void (null as unknown as AlertsApiResponse);
  void (null as unknown as AlertHistoryApiResponse);
  return Promise.resolve([]);
}

/** POST /api/alerts/{id}/acknowledge */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // await fetch(`${BASE}/${alertId}/acknowledge`, { method: 'POST' });
  // ─────────────────────────────────────────────────────────────────────────
  void alertId;
  return Promise.resolve();
}

/** POST /api/alerts/{id}/resolve */
export async function resolveAlert(alertId: string): Promise<void> {
  // ── MOCK ─────────────────────────────────────────────────────────────────
  // await fetch(`${BASE}/${alertId}/resolve`, { method: 'POST' });
  // ─────────────────────────────────────────────────────────────────────────
  void alertId;
  return Promise.resolve();
}
