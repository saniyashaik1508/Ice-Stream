export type PipelineStatus = 'healthy' | 'warning' | 'error' | 'offline';

export type PipelineStageId = 'ingest' | 'process' | 'serve';

export interface PipelineNodeData {
  id: PipelineStageId;
  label: string;
  technology: string;
  description: string;
  status: PipelineStatus;
  eventsPerSecond: number;
  latencyMs: number;
  errorRatePct?: number;
  partitionCount?: number;
  lastCheckpoint?: string;
  activeAlerts?: string[];
  specs?: {
    topicOrTable?: string;
    throughputTarget?: string;
    engineVersion?: string;
    clusterOrCatalog?: string;
  };
}

export interface PipelineSummaryMetrics {
  totalEventsPerSecond: number;
  healthyStages: number;
  totalStages: number;
  avgLatencyMs: number;
  activeAlertCount: number;
  systemStatus: PipelineStatus;
  lastUpdated: string;
}

/**
 * Future API response structure contract
 * Matches GET /api/pipeline/status or GET /api/health
 */
export interface PipelineStatusApiResponse {
  ingest: {
    status: PipelineStatus;
    eventsPerSecond: number;
    latencyMs: number;
    errorRatePct?: number;
  };
  process: {
    status: PipelineStatus;
    eventsPerSecond: number;
    latencyMs: number;
    errorRatePct?: number;
  };
  serve: {
    status: PipelineStatus;
    eventsPerSecond: number;
    latencyMs: number;
    errorRatePct?: number;
  };
}
