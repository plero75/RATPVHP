// ============================================================================
// 🗄️ SYSTÈME DE CACHE INTELLIGENT VHP3
// Cache multi-niveaux avec TTL adaptatif et compression
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  compressed?: boolean;
}

interface CacheStats {
  totalSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  entriesCount: number;
}

class IntelligentCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  // TTL adaptatifs selon le type de données
  private readonly TTL_CONFIG = {
    // Métadonnées des lignes (changent rarement)
    line_meta: 24 * 60 * 60 * 1000, // 24h
    
    // Données temps réel (périssables)
    realtime_transport: 60 * 1000, // 1min
    realtime_velib: 30 * 1000,     // 30s
    
    // Données semi-statiques
    weather: 10 * 60 * 1000,       // 10min
    news: 15 * 60 * 1000,          // 15min
    courses: 60 * 60 * 1000,       // 1h
    
    // GTFS fallback (stable dans la journée)
    gtfs_schedule: 6 * 60 * 60 * 1000, // 6h
    
    // Messages de trafic
    traffic_messages: 2 * 60 * 1000 // 2min
  };

  private shouldCompress(data: any): boolean {
    const serialized = JSON.stringify(data);
    return serialized.length > 1024; // Compresser si > 1KB
  }

  private compress(data: any): string {
    // Compression simple (en production, utiliser pako.js ou similar)
    return JSON.stringify(data);
  }

  private decompress(compressed: string): any {
    return JSON.parse(compressed);
  }

  set<T>(key: string, data: T, category: keyof typeof this.TTL_CONFIG): void {
    const ttl = this.TTL_CONFIG[category] || 60000;
    const shouldCompress = this.shouldCompress(data);
    
    const entry: CacheEntry<T> = {
      data: shouldCompress ? this.compress(data) as any : data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      compressed: shouldCompress
    };

    this.cache.set(key, entry);
    this.cleanExpired();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Vérifier expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Mise à jour des statistiques
    entry.hits++;
    this.stats.hits++;

    // Décompresser si nécessaire
    const data = entry.compressed ? 
      this.decompress(entry.data) : 
      entry.data;

    return data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Vérifier expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  private cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.evictions += cleaned;
  }

  // Nettoyage intelligent basé sur la fréquence d'utilisation
  smartCleanup(maxSize = 100): void {
    if (this.cache.size <= maxSize) return;

    // Trier par score (hits / age)
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        score: entry.hits / ((Date.now() - entry.timestamp) / 1000 / 60) // hits per minute
      }))
      .sort((a, b) => a.score - b.score); // Score faible = candidat à suppression

    // Supprimer les moins utilisés
    const toRemove = entries.slice(0, entries.length - maxSize);
    toRemove.forEach(({ key }) => {
      this.cache.delete(key);
      this.stats.evictions++;
    });
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalSize: this.cache.size,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      entriesCount: this.cache.size
    };
  }

  // Export pour debugging
  export(): Record<string, any> {
    const exported: Record<string, any> = {};
    for (const [key, entry] of this.cache.entries()) {
      exported[key] = {
        ...entry,
        age: Date.now() - entry.timestamp,
        remaining: Math.max(0, entry.ttl - (Date.now() - entry.timestamp))
      };
    }
    return exported;
  }
}

// Instance globale du cache
export const intelligentCache = new IntelligentCache();

// Wrapper pour les fonctions API avec cache automatique
export function withCache<T>(
  cacheKey: string,
  category: keyof typeof intelligentCache['TTL_CONFIG'],
  fetchFunction: () => Promise<T>
): () => Promise<T> {
  return async (): Promise<T> => {
    // Vérifier le cache d'abord
    const cached = intelligentCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Appel API et mise en cache
    const data = await fetchFunction();
    intelligentCache.set(cacheKey, data, category);
    return data;
  };
}

// Hook React avec cache intégré
export function useCachedData<T>(
  cacheKey: string,
  category: keyof typeof intelligentCache['TTL_CONFIG'],
  fetchFunction: () => Promise<T>,
  dependencies: any[] = []
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Vérifier le cache
      const cached = intelligentCache.get<T>(cacheKey);
      if (cached !== null) {
        setData(cached);
        setFromCache(true);
        setError(null);
        setLoading(false);
        return;
      }

      // Appel API
      setFromCache(false);
      const result = await fetchFunction();
      intelligentCache.set(cacheKey, result, category);
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, category, fetchFunction, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, fromCache };
}