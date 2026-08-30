import { PipelineNodeData, PipelineSummaryMetrics, PipelineStatusApiResponse } from '../types/pipeline';

export const initialPipelineStages: PipelineNodeData[] = [
  {
    id: 'ingest',
    label: 'INGEST',
    technology: 'Apache Kafka',
    description: 'Receives high-volume e-commerce transaction events',
    status: 'healthy',
    eventsPerSecond: 2450,
    latencyMs: 120,
    errorRatePct: 0.02,
    partitionCount: 16,
    specs: {
      topicOrTable: 'lakehouse.transactions.raw',
      throughputTarget: '5,000 evt/s',
      engineVersion: 'Kafka v3.6 (KRaft mode)',
      clusterOrCatalog: 'prod-kafka-cluster-us-east'
    }
  },
  {
    id: 'process',
    label: 'PROCESS',
    technology: 'Apache Flink',
    description: 'Processes and validates streaming data with Data Quality assertions',
    status: 'healthy',
    eventsPerSecond: 2380,
    latencyMs: 145,
    errorRatePct: 0.01,
    partitionCount: 32,
    lastCheckpoint: '2.4s ago (100% success)',
    specs: {
      topicOrTable: 'ice_stream_validation_job',
      throughputTarget: '5,000 evt/s',
      engineVersion: 'Flink v1.18.1',
      clusterOrCatalog: 'flink-k8s-taskmanager-pool'
    }
  },
  {
    id: 'serve',
    label: 'SERVE',
    technology: 'Apache Iceberg',
    description: 'Stores validated analytical lakehouse datasets with ACID guarantees',
    status: 'healthy',
    eventsPerSecond: 2310,
    latencyMs: 170,
    errorRatePct: 0.00,
    partitionCount: 4,
    specs: {
      topicOrTable: 'lakehouse_db.ecom_orders_v1',
      throughputTarget: 'Batch Commit ~30s',
      engineVersion: 'Iceberg v1.4 (REST Catalog)',
      clusterOrCatalog: 's3://icestream-lakehouse-data/'
    }
  }
];

/**
 * Calculates aggregate KPI metrics from an array of pipeline stages
 */
export function calculatePipelineSummary(stages: PipelineNodeData[]): PipelineSummaryMetrics {
  const totalEvents = stages.length > 0 ? stages[0].eventsPerSecond : 0;
  const healthyCount = stages.filter(s => s.status === 'healthy').length;
  const totalStages = stages.length;
  const avgLatency = stages.length > 0 
    ? Math.round(stages.reduce((acc, s) => acc + s.latencyMs, 0) / stages.length) 
    : 0;
  
  const hasError = stages.some(s => s.status === 'error');
  const hasWarning = stages.some(s => s.status === 'warning');
  const hasOffline = stages.some(s => s.status === 'offline');
  
  let systemStatus: 'healthy' | 'warning' | 'error' | 'offline' = 'healthy';
  let activeAlertCount = 0;

  stages.forEach(s => {
    if (s.status === 'error') activeAlertCount += 2;
    else if (s.status === 'warning') activeAlertCount += 1;
    else if (s.status === 'offline') activeAlertCount += 1;
  });

  if (hasError) systemStatus = 'error';
  else if (hasOffline) systemStatus = 'offline';
  else if (hasWarning) systemStatus = 'warning';

  const now = new Date();
  const timeString = now.toTimeString().split(' ')[0];

  return {
    totalEventsPerSecond: totalEvents,
    healthyStages: healthyCount,
    totalStages,
    avgLatencyMs: avgLatency,
    activeAlertCount,
    systemStatus,
    lastUpdated: timeString
  };
}

/**
 * Converts stages to the standard backend API contract schema
 * For future GET /api/pipeline/status endpoint compatibility
 */
export function toApiContractResponse(stages: PipelineNodeData[]): PipelineStatusApiResponse {
  const getStage = (id: string) => stages.find(s => s.id === id) || stages[0];
  const ingest = getStage('ingest');
  const process = getStage('process');
  const serve = getStage('serve');

  return {
    ingest: {
      status: ingest.status,
      eventsPerSecond: ingest.eventsPerSecond,
      latencyMs: ingest.latencyMs,
      errorRatePct: ingest.errorRatePct
    },
    process: {
      status: process.status,
      eventsPerSecond: process.eventsPerSecond,
      latencyMs: process.latencyMs,
      errorRatePct: process.errorRatePct
    },
    serve: {
      status: serve.status,
      eventsPerSecond: serve.eventsPerSecond,
      latencyMs: serve.latencyMs,
      errorRatePct: serve.errorRatePct
    }
  };
}
