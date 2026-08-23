import { useState, useEffect, useCallback } from 'react';
import { PipelineNodeData, PipelineStageId, PipelineStatus } from '../types/pipeline';
import { initialPipelineStages, calculatePipelineSummary } from '../data/pipelineData';

export type SimulationScenario = 'healthy' | 'warning-lag' | 'flink-backpressure' | 'iceberg-commit-delay';

export function usePipelineSimulation() {
  const [stages, setStages] = useState<PipelineNodeData[]>(initialPipelineStages);
  const [selectedStageId, setSelectedStageId] = useState<PipelineStageId | null>(null);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>('healthy');
  const [lastTickTime, setLastTickTime] = useState<string>(new Date().toTimeString().split(' ')[0]);

  // Jitter generator for realistic fluctuating data
  const applyMetricJitter = useCallback(() => {
    setStages(prevStages => {
      return prevStages.map(stage => {
        // Deterministic subtle random jitter (around ±1.5%)
        const deltaEvents = Math.floor((Math.random() - 0.48) * 35);
        const deltaLatency = Math.floor((Math.random() - 0.48) * 6);

        let newEvents = Math.max(100, stage.eventsPerSecond + deltaEvents);
        let newLatency = Math.max(20, stage.latencyMs + deltaLatency);

        // Adjust based on active scenario
        let currentStatus: PipelineStatus = stage.status;

        if (activeScenario === 'warning-lag' && stage.id === 'ingest') {
          currentStatus = 'warning';
          newLatency = Math.max(280, stage.latencyMs + 10);
        } else if (activeScenario === 'flink-backpressure' && stage.id === 'process') {
          currentStatus = 'warning';
          newLatency = Math.max(420, stage.latencyMs + 15);
          newEvents = Math.max(800, stage.eventsPerSecond - 40);
        } else if (activeScenario === 'iceberg-commit-delay' && stage.id === 'serve') {
          currentStatus = 'error';
          newLatency = 890;
        } else if (activeScenario === 'healthy') {
          currentStatus = 'healthy';
        }

        return {
          ...stage,
          eventsPerSecond: newEvents,
          latencyMs: newLatency,
          status: currentStatus,
        };
      });
    });

    setLastTickTime(new Date().toTimeString().split(' ')[0]);
  }, [activeScenario]);

  // Simulation timer loop
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      applyMetricJitter();
    }, 2800);

    return () => clearInterval(interval);
  }, [isLive, applyMetricJitter]);

  const toggleLive = () => {
    setIsLive(prev => !prev);
  };

  const manualRefresh = () => {
    applyMetricJitter();
  };

  const setScenario = (scenario: SimulationScenario) => {
    setActiveScenario(scenario);
    if (scenario === 'healthy') {
      setStages(initialPipelineStages);
    } else if (scenario === 'warning-lag') {
      setStages(prev => prev.map(s => s.id === 'ingest' ? { ...s, status: 'warning', latencyMs: 310 } : s));
    } else if (scenario === 'flink-backpressure') {
      setStages(prev => prev.map(s => s.id === 'process' ? { ...s, status: 'warning', latencyMs: 440, eventsPerSecond: 1850 } : s));
    } else if (scenario === 'iceberg-commit-delay') {
      setStages(prev => prev.map(s => s.id === 'serve' ? { ...s, status: 'error', latencyMs: 920 } : s));
    }
    setLastTickTime(new Date().toTimeString().split(' ')[0]);
  };

  const resetStages = () => {
    setActiveScenario('healthy');
    setStages(initialPipelineStages);
    setLastTickTime(new Date().toTimeString().split(' ')[0]);
  };

  const summary = calculatePipelineSummary(stages);
  summary.lastUpdated = lastTickTime;

  const selectedStage = stages.find(s => s.id === selectedStageId) || null;

  return {
    stages,
    summary,
    selectedStageId,
    selectedStage,
    setSelectedStageId,
    isLive,
    toggleLive,
    manualRefresh,
    activeScenario,
    setScenario,
    resetStages,
  };
}
