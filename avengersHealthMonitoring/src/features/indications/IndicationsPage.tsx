import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  SlidersHorizontal,
  Edit3,
  Check,
} from 'lucide-react';
import { animate, stagger } from 'animejs';
import {
  type AlertStatus,
  type BodyRegion,
  INITIAL_INDICATION_GROUPS,
  type IndicationGroup,
  type IndicationItem,
} from './data/indicationGroups';
import { BodyMapPanel } from './components/BodyMapPanel';

interface IndicationsPageProps {
  crewId: string;
  onLogout: () => void;
}

export const IndicationsPage: React.FC<IndicationsPageProps> = ({ crewId, onLogout }) => {
  const [groups, setGroups] = useState<IndicationGroup[]>(INITIAL_INDICATION_GROUPS);
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');
  const gridRef = useRef<HTMLDivElement>(null);

  const allItems = groups.flatMap((g) => g.items);

  useEffect(() => {
    if (gridRef.current) {
      animate(gridRef.current.querySelectorAll('.indication-card'), {
        opacity: [0, 1],
        translateY: [16, 0],
        delay: stagger(45),
        duration: 500,
        ease: 'outCubic',
      });
    }
  }, [selectedRegion]);

  // Basic alert evaluation logic matching the 10-indicator spec
  const evaluateAlert = (item: IndicationItem, rawVal: string): Partial<IndicationItem> => {
    const num = parseFloat(rawVal);
    if (item.id === 'spo2' && !isNaN(num)) {
      return {
        status: num < 92 ? 'critical' : num < 95 ? 'warning' : 'nominal',
      };
    }
    if (item.id === 'resting-hr' && !isNaN(num)) {
      return {
        status: num > 100 || num < 45 ? 'critical' : num > 85 ? 'warning' : 'nominal',
      };
    }
    if (item.id === 'body-temp' && !isNaN(num)) {
      return {
        status: num >= 38.0 ? 'critical' : num >= 37.2 ? 'warning' : 'nominal',
      };
    }
    if (item.id === 'cabin-co2' && !isNaN(num)) {
      return {
        status: num > 5.0 ? 'critical' : num > 3.5 ? 'warning' : 'nominal',
      };
    }
    if (item.id === 'radiation-dose' && !isNaN(num)) {
      return {
        status: num >= 600 ? 'critical' : num >= 450 ? 'warning' : 'nominal',
      };
    }
    if (item.id === 'mood-stress' && !isNaN(num)) {
      const isLow = num <= 12;
      return {
        status: isLow ? 'critical' : num <= 15 ? 'warning' : 'nominal',
        privateSurgeonFlag: isLow,
      };
    }
    return {};
  };

  const handleStartEdit = (item: IndicationItem) => {
    setEditingId(item.id);
    setDraftValue(item.currentValue);
  };

  const handleSaveEdit = (groupId: string, item: IndicationItem) => {
    const updatedFields = evaluateAlert(item, draftValue);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          items: g.items.map((it) =>
            it.id === item.id
              ? { ...it, currentValue: draftValue || it.currentValue, ...updatedFields }
              : it
          ),
        };
      })
    );
    setEditingId(null);
  };

  const renderStatusBadge = (status: AlertStatus, privateFlag?: boolean) => {
    if (status === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger/15 text-danger">
          <ShieldAlert className="w-3.5 h-3.5" />
          {privateFlag ? 'Surgeon Flag' : 'Alert'}
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5" />
          Trend Watch
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Nominal
      </span>
    );
  };

  const nominalCount = allItems.filter((i) => i.status === 'nominal').length;
  const attentionCount = allItems.length - nominalCount;

  return (
    <div className="min-h-screen bg-surface text-ink flex flex-col">
      {/* Top Dark Header */}
      <header className="bg-ink text-white border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight">
                  HERMES Health Monitor
                </h1>
                <span className="hidden md:inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-ink-soft text-brand-light border border-white/10">
                  {crewId}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                10 Core Physiological & Habitat Indicators
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
              <span className="text-emerald-400">NOMINAL: {nominalCount}/10</span>
              {attentionCount > 0 && (
                <span className="text-red-400">ALERTS: {attentionCount}</span>
              )}
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-soft hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Interactive Body Map & Habitat Panel */}
        <div className="lg:col-span-4 xl:col-span-3">
          <BodyMapPanel
            items={allItems}
            selectedRegion={selectedRegion}
            onSelectRegion={setSelectedRegion}
          />
        </div>

        {/* Right Column: Indication Groups */}
        <div ref={gridRef} className="lg:col-span-8 xl:col-span-9 space-y-8">
          {selectedRegion !== 'ALL' && (
            <div className="bg-brand/10 border border-brand/25 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-brand-dark font-medium">
                <SlidersHorizontal className="w-4 h-4" />
                Filtered by region: <strong>{selectedRegion}</strong>
              </div>
              <button
                onClick={() => setSelectedRegion('ALL')}
                className="text-xs font-semibold text-brand hover:text-brand-dark cursor-pointer"
              >
                Reset filter
              </button>
            </div>
          )}

          {groups.map((group) => {
            const visibleItems =
              selectedRegion === 'ALL'
                ? group.items
                : group.items.filter((item) => item.region === selectedRegion);

            if (visibleItems.length === 0) return null;

            return (
              <section key={group.id} className="space-y-3">
                <div className="border-b border-slate-200 pb-2">
                  <h2 className="text-lg font-bold text-ink">{group.title}</h2>
                  <p className="text-xs text-slate-500">{group.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleItems.map((item) => {
                    const isEditing = editingId === item.id;

                    return (
                      <article
                        key={item.id}
                        className={`indication-card bg-white rounded-xl border p-4 shadow-xs transition-all ${
                          item.status === 'critical'
                            ? 'border-danger/50 ring-1 ring-danger/20'
                            : item.status === 'warning'
                            ? 'border-amber-400/60'
                            : 'border-slate-200/90 hover:border-brand/40'
                        }`}
                      >
                        {/* Card Top Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block text-[11px] font-mono uppercase tracking-wider text-brand font-semibold">
                              {item.region}
                            </span>
                            <h3 className="text-base font-bold text-ink">{item.name}</h3>
                          </div>
                          {renderStatusBadge(item.status, item.privateSurgeonFlag)}
                        </div>

                        {/* Value & Quick Log Input */}
                        <div className="mt-3 p-3 rounded-lg bg-surface flex items-center justify-between gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-2 w-full">
                              <input
                                type="text"
                                value={draftValue}
                                onChange={(e) => setDraftValue(e.target.value)}
                                placeholder={item.inputLabel}
                                autoFocus
                                className="w-full px-2.5 py-1.5 text-sm font-mono bg-white border border-brand rounded-md focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveEdit(group.id, item)}
                                className="p-1.5 rounded-md bg-brand text-white hover:bg-brand-dark cursor-pointer"
                                title="Save reading"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div>
                                <div className="text-xl font-bold font-mono text-ink">
                                  {item.currentValue}{' '}
                                  {!item.currentValue.includes(item.unit) && (
                                    <span className="text-xs font-normal text-slate-500">
                                      {item.unit}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Baseline: {item.baseline}
                                </div>
                              </div>

                              <button
                                onClick={() => handleStartEdit(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:border-brand text-xs font-medium text-ink transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-brand" />
                                Log
                              </button>
                            </>
                          )}
                        </div>

                        {/* Hazard & Alert Logic Metadata */}
                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          <p>
                            <span className="font-semibold text-ink">Hazard:</span> {item.hazard}
                          </p>
                          <p>
                            <span className="font-semibold text-ink">Alert logic:</span>{' '}
                            {item.alertLogic}
                          </p>
                          {item.trendNote && (
                            <p className="text-[11px] font-mono text-brand-dark pt-1">
                              ↳ {item.trendNote}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
};