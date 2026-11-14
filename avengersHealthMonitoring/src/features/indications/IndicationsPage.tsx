import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  SlidersHorizontal,
  Edit3,
  Check,
  Minus,
} from 'lucide-react';
import { animate, stagger } from 'animejs';
import {
  type AlertStatus,
  type BodyRegion,
  INITIAL_INDICATION_GROUPS,
  type IndicationGroup,
  type IndicationItem,
} from './data/indicationGroups';
import { BINDING_BY_ITEM_ID, toAlertStatus } from './data/indicatorBindings';
import { healthApi, ApiError } from './api/healthApi';
import { useHealthData } from './hooks/useHealthData';
import { BodyMapPanel } from './components/BodyMapPanel';
import { ModelPanel } from './components/ModelPanel';

interface IndicationsPageProps {
  crewId: string;
  onLogout: () => void;
}

export const IndicationsPage: React.FC<IndicationsPageProps> = ({ crewId, onLogout }) => {
  const { snapshot, error, loading, refresh } = useHealthData();
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Card content with the backend's rating and newest values filled in.
  const groups = useMemo<IndicationGroup[]>(
    () =>
      INITIAL_INDICATION_GROUPS.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const binding = BINDING_BY_ITEM_ID[item.id];
          const result = snapshot?.statuses[binding.indicatorId];
          const values = snapshot?.latestValues[binding.indicatorId];
          return {
            ...item,
            status: toAlertStatus(result?.status),
            message: result?.message,
            currentValue: values ? binding.format(values) : '—',
            privateSurgeonFlag: item.id === 'mood-stress' && result?.escalate === true,
          };
        }),
      })),
    [snapshot],
  );

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

  const handleStartEdit = (item: IndicationItem) => {
    const binding = BINDING_BY_ITEM_ID[item.id];
    const empty: Record<string, string> = {};
    binding.fields.forEach((field) => {
      empty[field.key] = '';
    });
    setDraftValues(empty);
    setEditError(null);
    setEditingId(item.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleSaveEdit = async (item: IndicationItem) => {
    const binding = BINDING_BY_ITEM_ID[item.id];

    // Check the typed numbers here; the backend checks the allowed ranges.
    const values: Record<string, number> = {};
    for (const field of binding.fields) {
      const raw = (draftValues[field.key] ?? '').trim();
      if (raw === '') {
        if (field.optional) continue;
        setEditError(`Enter ${field.label}.`);
        return;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        setEditError(`${field.label} must be a number.`);
        return;
      }
      values[field.key] = num;
    }

    setSaving(true);
    setEditError(null);
    try {
      await healthApi.postReading({ indicatorId: binding.indicatorId, values });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Could not save the reading.');
    } finally {
      setSaving(false);
    }
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          Trend Watch
        </span>
      );
    }
    if (status === 'unknown') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300">
          <Minus className="w-3.5 h-3.5" />
          No data
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Nominal
      </span>
    );
  };

  const nominalCount = allItems.filter((i) => i.status === 'nominal').length;
  const alertCount = allItems.filter((i) => i.status === 'warning' || i.status === 'critical').length;

  return (
    <div className="starfield min-h-screen text-slate-200 flex flex-col">
      {/* Top Dark Header */}
      <header className="bg-night/80 backdrop-blur text-slate-200 border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/mission-logo.png" alt="" className="w-10 h-10 rounded-full object-cover scale-110 ring-1 ring-white/10" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight">
                  Astronaut Health Monitor
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
              {alertCount > 0 && <span className="text-red-400">ALERTS: {alertCount}</span>}
              {snapshot && (
                <>
                  <span className="hidden md:inline text-slate-300">STREAK: {snapshot.streak}d</span>
                  <span className="hidden md:inline text-slate-300">POINTS: {snapshot.points}</span>
                </>
              )}
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-soft hover:bg-panel/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Backend status message */}
      {(error || loading) && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
          {error ? (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-slate-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-danger block">Backend not available</span>
                {error} Values and statuses are not shown until it is running again.
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Loading readings…</p>
          )}
        </div>
      )}

      {/* Main Content Layout */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Interactive Body Map & Habitat Panel */}
        <div className="lg:col-span-3">
          <BodyMapPanel
            items={allItems}
            selectedRegion={selectedRegion}
            onSelectRegion={setSelectedRegion}
          />
        </div>

        {/* Right Column: Indication Groups */}
        <div ref={gridRef} className="lg:col-span-5 space-y-8">
          {selectedRegion !== 'ALL' && (
            <div className="bg-ink-soft/80 border border-brand-light/40 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-200 font-medium">
                <SlidersHorizontal className="w-4 h-4" />
                Filtered by region: <strong>{selectedRegion}</strong>
              </div>
              <button
                onClick={() => setSelectedRegion('ALL')}
                className="text-xs font-semibold text-brand-light hover:text-brand-light cursor-pointer"
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
                <div className="border-b border-brand-light/30 pb-2">
                  <h2 className="text-lg font-bold text-slate-200">{group.title}</h2>
                  <p className="text-xs text-slate-500">{group.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleItems.map((item) => {
                    const isEditing = editingId === item.id;
                    const binding = BINDING_BY_ITEM_ID[item.id];

                    return (
                      <article
                        key={item.id}
                        className={`indication-card bg-panel rounded-xl border p-4 shadow-md transition-all ${
                          item.status === 'critical'
                            ? 'border-danger/50 ring-1 ring-danger/20'
                            : item.status === 'warning'
                            ? 'border-amber-400/60'
                            : 'border-white/10 hover:border-brand-light/60'
                        }`}
                      >
                        {/* Card Top Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block text-[11px] font-mono uppercase tracking-wider text-brand-light font-semibold">
                              {item.region}
                            </span>
                            <h3 className="text-base font-bold text-slate-200">{item.name}</h3>
                          </div>
                          {renderStatusBadge(item.status, item.privateSurgeonFlag)}
                        </div>

                        {/* Value & Log input */}
                        <div className="mt-3 p-3 rounded-lg bg-white/5 flex items-center justify-between gap-2">
                          {isEditing ? (
                            <div className="w-full space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                {binding.fields.map((field) => (
                                  <label
                                    key={field.key}
                                    className="flex flex-col gap-1 text-[11px] text-slate-400"
                                  >
                                    {field.label}
                                    {field.optional && ' (optional)'}
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min={field.min}
                                      max={field.max}
                                      step={field.step}
                                      value={draftValues[field.key] ?? ''}
                                      onChange={(e) =>
                                        setDraftValues((prev) => ({
                                          ...prev,
                                          [field.key]: e.target.value,
                                        }))
                                      }
                                      className="px-2.5 py-1.5 text-sm font-mono text-slate-200 bg-panel border border-brand rounded-md focus:outline-none"
                                    />
                                  </label>
                                ))}
                              </div>
                              {editError && <p className="text-xs text-red-300">{editError}</p>}
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="px-2.5 py-1.5 rounded-md bg-panel border border-white/10 hover:border-brand text-xs font-medium text-slate-200 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => handleSaveEdit(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-dark cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                                  title="Save reading"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {saving ? 'Saving…' : 'Save reading'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <div className="text-xl font-bold font-mono text-slate-200">
                                  {item.currentValue}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Baseline: {item.baseline}
                                </div>
                              </div>

                              <button
                                onClick={() => handleStartEdit(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-panel border border-white/10 hover:border-brand text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-brand-light" />
                                Log
                              </button>
                            </>
                          )}
                        </div>

                        {/* Backend explanation of the latest rating */}
                        {item.message && (
                          <p className="mt-2 text-xs text-slate-200">{item.message}</p>
                        )}

                        {/* Hazard & Alert Logic Metadata */}
                        <div className="mt-3 space-y-1 text-xs text-slate-400">
                          <p>
                            <span className="font-semibold text-slate-200">Hazard:</span> {item.hazard}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-200">Alert logic:</span>{' '}
                            {item.alertLogic}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Right Column: 3D body model, full height */}
        <div className="lg:col-span-4">
          <ModelPanel items={allItems} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
        </div>
      </main>
    </div>
  );
};
