// ============================================================================
// 🚀 SYSTÈME D'ACTUALISATION ADAPTATIVE VHP3
// Optimisation intelligente des appels API selon contexte temps réel
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

interface AdaptiveConfig {
  baseInterval: number;
  minInterval: number;
  maxInterval: number;
  condition: (data: any, lastData: any) => 'fast' | 'normal' | 'slow';
}

interface ModuleStatus {
  lastUpdate: number;
  lastData: any;
  currentInterval: number;
  apiCallCount: number;
  errors: number;
}

class AdaptiveScheduler {
  private modules = new Map<string, ModuleStatus>();
  private configs: Record<string, AdaptiveConfig> = {
    // RER A : 15-90s selon proximité des passages
    rer_a: {
      baseInterval: 30000,
      minInterval: 15000,
      maxInterval: 90000,
      condition: (data, lastData) => {
        const hasImminentPassage = data?.visits?.some((v: any) => v.minutes <= 2);
        const hasActiveService = data?.visits?.length > 0;
        if (hasImminentPassage) return 'fast';
        if (!hasActiveService) return 'slow';
        return 'normal';
      }
    },

    // Bus : 20-90s selon activité
    bus: {
      baseInterval: 30000,
      minInterval: 20000,
      maxInterval: 90000,
      condition: (data, lastData) => {
        const totalPassages = data?.reduce((sum: number, line: any) => 
          sum + line.directions?.reduce((s: number, d: any) => s + d.list?.length || 0, 0), 0) || 0;
        const hasImminentBus = data?.some((line: any) => 
          line.directions?.some((d: any) => 
            d.list?.some((v: any) => v.minutes <= 3)));
        
        if (hasImminentBus) return 'fast';
        if (totalPassages === 0) return 'slow';
        return 'normal';
      }
    },

    // Vélib' : 90-180s selon variation
    velib: {
      baseInterval: 60000,
      minInterval: 90000,
      maxInterval: 180000,
      condition: (data, lastData) => {
        if (!lastData || !data) return 'normal';
        
        const currentBikes = data.reduce((sum: number, station: any) => 
          sum + (station.bikes || 0), 0);
        const lastBikes = lastData.reduce((sum: number, station: any) => 
          sum + (station.bikes || 0), 0);
        
        const variation = Math.abs(currentBikes - lastBikes);
        if (variation >= 5) return 'fast'; // Forte variation
        if (variation <= 1) return 'slow'; // Stable
        return 'normal';
      }
    },

    // Trafic : 180s si aucun message actif
    traffic: {
      baseInterval: 120000,
      minInterval: 120000,
      maxInterval: 180000,
      condition: (data, lastData) => {
        const hasMessages = Array.isArray(data) && data.length > 0;
        return hasMessages ? 'normal' : 'slow';
      }
    },

    // Météo, Courses, News : fréquences fixes
    weather: {
      baseInterval: 600000,
      minInterval: 600000,
      maxInterval: 600000,
      condition: () => 'normal'
    },

    courses: {
      baseInterval: 300000,
      minInterval: 300000,
      maxInterval: 300000,
      condition: () => 'normal'
    },

    news: {
      baseInterval: 300000,
      minInterval: 300000,
      maxInterval: 300000,
      condition: () => 'normal'
    }
  };

  private getInterval(moduleId: string, condition: 'fast' | 'normal' | 'slow'): number {
    const config = this.configs[moduleId];
    if (!config) return 60000;

    switch (condition) {
      case 'fast': return config.minInterval;
      case 'slow': return config.maxInterval;
      default: return config.baseInterval;
    }
  }

  shouldUpdate(moduleId: string, currentData?: any): boolean {
    const status = this.modules.get(moduleId);
    if (!status) {
      // Premier appel
      this.modules.set(moduleId, {
        lastUpdate: Date.now(),
        lastData: null,
        currentInterval: this.configs[moduleId]?.baseInterval || 60000,
        apiCallCount: 0,
        errors: 0
      });
      return true;
    }

    const elapsed = Date.now() - status.lastUpdate;
    return elapsed >= status.currentInterval;
  }

  updateModule(moduleId: string, data: any, error?: boolean): void {
    const status = this.modules.get(moduleId) || {
      lastUpdate: 0,
      lastData: null,
      currentInterval: 60000,
      apiCallCount: 0,
      errors: 0
    };

    const config = this.configs[moduleId];
    if (config && !error) {
      const condition = config.condition(data, status.lastData);
      status.currentInterval = this.getInterval(moduleId, condition);
      status.lastData = data;
    }

    status.lastUpdate = Date.now();
    status.apiCallCount += 1;
    if (error) status.errors += 1;

    this.modules.set(moduleId, status);
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [moduleId, status] of this.modules) {
      stats[moduleId] = {
        interval: status.currentInterval,
        apiCalls: status.apiCallCount,
        errors: status.errors,
        lastUpdate: new Date(status.lastUpdate).toLocaleTimeString('fr-FR')
      };
    }
    return stats;
  }

  getTotalApiCalls(): number {
    return Array.from(this.modules.values())
      .reduce((sum, status) => sum + status.apiCallCount, 0);
  }

  getEstimatedDailyReduction(): number {
    // Calcul basé sur les fréquences adaptatives vs fréquences fixes
    let fixedCallsPerDay = 0;
    let adaptiveCallsPerDay = 0;

    for (const [moduleId, config] of Object.entries(this.configs)) {
      const dailyMinutes = 24 * 60;
      
      // Appels avec fréquence fixe
      const fixedCalls = Math.floor((dailyMinutes * 60 * 1000) / config.baseInterval);
      fixedCallsPerDay += fixedCalls;
      
      // Estimation appels adaptatifs (moyenne entre min et max)
      const avgInterval = (config.minInterval + config.maxInterval) / 2;
      const adaptiveCalls = Math.floor((dailyMinutes * 60 * 1000) / avgInterval);
      adaptiveCallsPerDay += adaptiveCalls;
    }

    return Math.max(0, fixedCallsPerDay - adaptiveCallsPerDay);
  }
}

// Instance globale du scheduler
export const adaptiveScheduler = new AdaptiveScheduler();

// Hook React pour l'actualisation adaptative
export function useAdaptiveUpdate<T>(
  moduleId: string,
  fetchFunction: () => Promise<T>,
  dependencies: any[] = []
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  stats: any;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!adaptiveScheduler.shouldUpdate(moduleId, data)) return;

    try {
      setLoading(true);
      const result = await fetchFunction();
      setData(result);
      setError(null);
      adaptiveScheduler.updateModule(moduleId, result);
    } catch (err: any) {
      setError(err.message);
      adaptiveScheduler.updateModule(moduleId, null, true);
    } finally {
      setLoading(false);
    }
  }, [moduleId, fetchFunction, ...dependencies]);

  useEffect(() => {
    fetchData();
    
    // Vérification périodique toutes les 5 secondes
    const interval = setInterval(() => {
      if (adaptiveScheduler.shouldUpdate(moduleId)) {
        fetchData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    stats: adaptiveScheduler.getStats()[moduleId] || {}
  };
}