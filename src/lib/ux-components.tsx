// ============================================================================
// 🎨 COMPOSANTS UX OPTIMISÉS POUR RATPVHP VHP3
// Interface utilisateur avancée avec états visuels intelligents
// ============================================================================

import React, { useState, useEffect } from 'react';
import { adaptiveScheduler } from './adaptive-scheduler';
import { intelligentCache } from './intelligent-cache';

// ============================================================================
// 🎯 StatusIndicator - Indicateur d'état unifié
// ============================================================================

interface StatusIndicatorProps {
  status: 'loading' | 'ok' | 'warning' | 'error' | 'ended';
  pulseOnUpdate?: boolean;
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  pulseOnUpdate = false,
  showIcon = true,
  showText = false,
  size = 'md'
}) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pulseOnUpdate && status === 'ok') {
      setPulse(true);
      const timeout = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [status, pulseOnUpdate]);

  const config = {
    loading: {
      icon: '⌛',
      color: 'text-gray-500',
      bg: 'bg-gray-100',
      text: 'Chargement...'
    },
    ok: {
      icon: '🟢',
      color: 'text-green-600',
      bg: 'bg-green-100',
      text: 'Opérationnel'
    },
    warning: {
      icon: '🟡',
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
      text: 'Perturbations'
    },
    error: {
      icon: '🔴',
      color: 'text-red-600',
      bg: 'bg-red-100',
      text: 'Erreur'
    },
    ended: {
      icon: '⚫',
      color: 'text-gray-400',
      bg: 'bg-gray-100',
      text: 'Service terminé'
    }
  };

  const sizeClasses = {
    sm: 'text-sm p-1',
    md: 'text-base p-2',
    lg: 'text-lg p-3'
  };

  const statusConfig = config[status];
  const sizeClass = sizeClasses[size];

  return (
    <div className={`
      inline-flex items-center gap-1 rounded-full
      ${statusConfig.bg} ${statusConfig.color} ${sizeClass}
      ${pulse ? 'animate-pulse' : ''}
      transition-all duration-300
    `}>
      {showIcon && <span>{statusConfig.icon}</span>}
      {showText && <span className="text-xs font-medium">{statusConfig.text}</span>}
    </div>
  );
};

// ============================================================================
// ⏱️ TimeBadge - Badge de temps avec états visuels
// ============================================================================

interface TimeBadgeProps {
  time: string;
  minutes?: number | null;
  delay?: number | null;
  cancelled?: boolean;
  aimed?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export const TimeBadge: React.FC<TimeBadgeProps> = ({
  time,
  minutes,
  delay,
  cancelled,
  aimed,
  size = 'md'
}) => {
  const getStatus = () => {
    if (cancelled) return 'cancelled';
    if (minutes !== null && minutes <= 1) return 'imminent';
    if (delay && delay > 0) return 'delayed';
    return 'normal';
  };

  const status = getStatus();

  const statusConfig = {
    normal: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800'
    },
    imminent: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-800'
    },
    delayed: {
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      text: 'text-orange-800'
    },
    cancelled: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800'
    }
  };

  const sizeConfig = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const config = statusConfig[status];
  const sizeClass = sizeConfig[size];

  return (
    <div className={`
      inline-flex items-center gap-1 rounded-lg border font-mono font-bold
      ${config.bg} ${config.border} ${config.text} ${sizeClass}
      transition-all duration-200
    `}>
      {aimed && delay && delay > 0 && (
        <span className="line-through opacity-60">{aimed}</span>
      )}
      <span>{time}</span>
      {delay && delay > 0 && !cancelled && (
        <span className="text-xs">+{delay}min</span>
      )}
      {status === 'imminent' && <span className="animate-pulse">🟢</span>}
      {cancelled && <span>❌</span>}
    </div>
  );
};

// ============================================================================
// 🚌 LineChip - Puce de ligne avec couleurs officielles
// ============================================================================

interface LineChipProps {
  code: string;
  color?: string;
  textColor?: string;
  mode?: 'rer' | 'bus' | 'metro' | 'tram';
  size?: 'sm' | 'md' | 'lg';
  showMode?: boolean;
}

export const LineChip: React.FC<LineChipProps> = ({
  code,
  color = '#0055c3',
  textColor = '#ffffff',
  mode = 'bus',
  size = 'md',
  showMode = false
}) => {
  const modeIcons = {
    rer: '🚆',
    bus: '🚌',
    metro: '🚇',
    tram: '🚊'
  };

  const sizeConfig = {
    sm: 'px-1.5 py-0.5 text-xs min-w-[24px]',
    md: 'px-2 py-1 text-sm min-w-[32px]',
    lg: 'px-3 py-1.5 text-base min-w-[40px]'
  };

  const sizeClass = sizeConfig[size];

  return (
    <div className={`
      inline-flex items-center justify-center gap-1 rounded font-bold
      ${sizeClass}
      transition-transform duration-200 hover:scale-105
    `}
    style={{ backgroundColor: color, color: textColor }}>
      {showMode && <span>{modeIcons[mode]}</span>}
      <span>{code}</span>
    </div>
  );
};

// ============================================================================
// 📊 PerformanceDashboard - Tableau de bord performance
// ============================================================================

export const PerformanceDashboard: React.FC = () => {
  const [apiStats, setApiStats] = useState<any>({});
  const [cacheStats, setCacheStats] = useState<any>({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setApiStats({
        modules: adaptiveScheduler.getStats(),
        totalCalls: adaptiveScheduler.getTotalApiCalls(),
        estimatedReduction: adaptiveScheduler.getEstimatedDailyReduction()
      });
      setCacheStats(intelligentCache.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const reductionPercentage = apiStats.estimatedReduction > 0 ? 
    ((apiStats.estimatedReduction / 9000) * 100).toFixed(1) : '0';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`
        bg-white shadow-lg rounded-lg border transition-all duration-300
        ${isExpanded ? 'p-4 w-80' : 'p-2 w-12 h-12'}
      `}>
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full h-full flex items-center justify-center text-lg"
            title="Ouvrir le tableau de bord performance"
          >
            📊
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Performance VHP3</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Métriques API */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 p-2 rounded text-center">
                <div className="font-bold text-blue-800">
                  {reductionPercentage}%
                </div>
                <div className="text-xs text-blue-600">Réduction API</div>
              </div>
              
              <div className="bg-green-50 p-2 rounded text-center">
                <div className="font-bold text-green-800">
                  {(cacheStats.hitRate * 100 || 0).toFixed(1)}%
                </div>
                <div className="text-xs text-green-600">Cache Hit</div>
              </div>
            </div>

            {/* Détails modules */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(apiStats.modules || {}).map(([module, stats]: [string, any]) => (
                <div key={module} className="flex justify-between text-xs">
                  <span className="truncate">{module}</span>
                  <span className="text-gray-500">
                    {(stats.interval / 1000).toFixed(0)}s
                  </span>
                </div>
              ))}
            </div>

            {/* Actions rapides */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  intelligentCache.clear();
                  console.log('Cache vidé');
                }}
                className="flex-1 bg-red-50 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-100"
              >
                Clear Cache
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-100"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 🔄 LoadingSpinner - Spinner de chargement avec contexte
// ============================================================================

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  context?: string;
  transparent?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message = 'Chargement...',
  context,
  transparent = false
}) => {
  const sizeConfig = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const sizeClass = sizeConfig[size];

  return (
    <div className={`
      flex items-center gap-2 p-3 rounded-lg
      ${transparent ? 'bg-transparent' : 'bg-gray-50'}
    `}>
      <div className={`
        ${sizeClass} border-2 border-gray-300 border-t-blue-500 
        rounded-full animate-spin
      `} />
      <div className="text-sm text-gray-600">
        <div>{message}</div>
        {context && <div className="text-xs text-gray-400">{context}</div>}
      </div>
    </div>
  );
};