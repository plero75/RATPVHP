import React, { useState, useEffect } from 'react';
import { TransportCard } from './TransportCard';
import { Card } from './Card';
import { STOP_IDS, JOINVILLE_BUS_DISCOVERY_ID } from '../constants';
import { fetchStopMonitoring, fetchAllBusesSummary, hhmm } from '../services/api';
import type { BusSummary } from '../types';
import { useAdaptiveUpdate } from '../src/lib/adaptive-scheduler';
import { StatusIndicator, TimeBadge, LineChip, LoadingSpinner } from '../src/lib/ux-components';

const RER_A_CONFIG = [
    { type: 'filter' as const, lineId: 'C01742', test: (dest: string) => /(paris|défense|nanterre|poissy|cergy|nation|etoile|haussmann)/i.test(dest), destName: 'Vers Paris', meta: { code: "RER A", color: "#e41e26", text: "#fff" } },
    { type: 'filter' as const, lineId: 'C01742', test: (dest:string) => /(boissy|marne|val d'europe|chessy|torcy|noisiel|bussy|noisy|fontenay|bry|champigny)/i.test(dest), destName: 'Vers Marne-la-Vallée / Boissy', meta: { code: "RER A", color: "#e41e26", text: "#fff" } }
];

const HIPPO_CONFIG = [{ type: 'code' as const, value: '77', lineId: 'C02251' }];
const BREUIL_CONFIG = [{ type: 'code' as const, value: '201', lineId: 'C01219' }, { type: 'code' as const, value: '77', lineId: 'C02251' }];

const BusLine: React.FC<{ summary: BusSummary }> = ({ summary }) => {
    const { meta, planned, directions } = summary;
    const hasRealTimeData = directions.some(d => d.list.length > 0);

    return (
        <div className="bg-[#f7f9ff] border border-app-panel-border rounded-lg p-2 my-2">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <LineChip 
                        code={meta.code}
                        color={meta.color}
                        textColor={meta.text}
                        mode="bus"
                        size="md"
                    />
                    <span className="font-semibold text-app-text">{meta.name}</span>
                </div>
                {planned.first && planned.last && (
                    <div className="text-xs text-gray-500">
                        Service de {hhmm(planned.first)} à {hhmm(planned.last)}
                    </div>
                )}
            </div>
            <div className="space-y-3">
                {hasRealTimeData ? (
                    directions.map((dir, index) => (
                        <div key={index} className="grid grid-cols-2 items-center text-sm gap-2">
                            <div className="font-bold text-app-blue truncate">{dir.dest || 'Direction'}</div>
                            <div className="flex flex-wrap gap-2 justify-end">
                                {dir.list.map((visit, vIndex) => (
                                    <TimeBadge
                                        key={vIndex}
                                        time={visit.minutes !== null ? `${visit.minutes} min` : '...'}
                                        minutes={visit.minutes}
                                        delay={visit.delayMin}
                                        cancelled={visit.cancelled}
                                        aimed={visit.expected ? hhmm(visit.expected) : null}
                                        size="sm"
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-xs text-gray-500 text-center py-2 italic">
                        Pas de service en temps réel. Données théoriques indisponibles.
                    </div>
                )}
            </div>
        </div>
    );
};

const BusList: React.FC<{ summaries: BusSummary[], loading: boolean }> = ({ summaries, loading }) => {
    if (loading) {
        return (
            <div className="flex justify-center py-4">
                <LoadingSpinner 
                    message="Découverte et chargement des lignes de bus..."
                    context="Analyse des lignes disponibles"
                    size="md"
                />
            </div>
        );
    }
    if (summaries.length === 0) {
        return (
            <div className="text-center py-4">
                <StatusIndicator status="error" showIcon showText />
                <div className="text-sm text-gray-500 mt-2">Aucune ligne de bus trouvée ou service interrompu.</div>
            </div>
        );
    }

    const half = Math.ceil(summaries.length / 2);
    const leftList = summaries.slice(0, half);
    const rightList = summaries.slice(half);

    const renderList = (list: BusSummary[]) => list.map(s => <BusLine key={s.meta.code} summary={s} />);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <div>{renderList(leftList)}</div>
            <div>{renderList(rightList)}</div>
        </div>
    );
};

export const TransportSection: React.FC = () => {
    // Utilisation du scheduler adaptatif pour les bus
    const { data: busSummaries, loading: busLoading, error: busError, stats: busStats } = useAdaptiveUpdate(
        'bus',
        () => fetchAllBusesSummary(JOINVILLE_BUS_DISCOVERY_ID, STOP_IDS.JOINVILLE_BUS_SIRI),
        []
    );

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TransportCard
                    title={
                        <div className="flex items-center gap-2">
                            <span><strong>Joinville-le-Pont</strong> — RER A</span>
                            <StatusIndicator status="ok" size="sm" />
                        </div>
                    }
                    stopId={STOP_IDS.RER_A}
                    lineConfigs={RER_A_CONFIG}
                    fetchFn={fetchStopMonitoring}
                />
                <TransportCard
                    title={
                        <div className="flex items-center gap-2">
                            <span><strong>Hippodrome de Vincennes</strong> — Bus 77</span>
                            <StatusIndicator status="ok" size="sm" />
                        </div>
                    }
                    stopId={STOP_IDS.HIPPODROME}
                    lineConfigs={HIPPO_CONFIG}
                    fetchFn={fetchStopMonitoring}
                />
                <TransportCard
                    title={
                        <div className="flex items-center gap-2">
                            <span><strong>École du Breuil</strong> — Bus 201 / 77</span>
                            <StatusIndicator status="ok" size="sm" />
                        </div>
                    }
                    stopId={STOP_IDS.BREUIL}
                    lineConfigs={BREUIL_CONFIG}
                    fetchFn={fetchStopMonitoring}
                />
            </div>
            <div className="grid grid-cols-1 gap-4">
                 <Card
                    title={
                        <div className="flex items-center justify-between">
                            <span><strong>Joinville-le-Pont</strong> — Tous les bus (hors RER)</span>
                            <div className="flex items-center gap-2">
                                <StatusIndicator 
                                    status={busError ? 'error' : busLoading ? 'loading' : 'ok'} 
                                    size="sm" 
                                    pulseOnUpdate
                                />
                                {busStats.interval && (
                                    <div className="text-xs text-gray-500">
                                        Actualisation: {(busStats.interval / 1000).toFixed(0)}s
                                    </div>
                                )}
                            </div>
                        </div>
                    }
                    fullWidth
                 >
                    {busError ? (
                        <div className="text-center py-4">
                            <StatusIndicator status="error" showIcon showText />
                            <div className="text-sm text-red-600 mt-2">Erreur: {busError}</div>
                        </div>
                    ) : (
                        <BusList summaries={busSummaries || []} loading={busLoading} />
                    )}
                 </Card>
            </div>
        </>
    );
};