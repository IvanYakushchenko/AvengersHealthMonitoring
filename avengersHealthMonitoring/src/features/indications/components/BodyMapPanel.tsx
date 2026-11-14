import React from 'react';
import { ShieldAlert, Radio } from 'lucide-react';
import { type AlertStatus, type BodyRegion, type IndicationItem } from '../data/indicationGroups';

interface BodyMapPanelProps {
  items: IndicationItem[];
  selectedRegion: BodyRegion | 'ALL';
  onSelectRegion: (region: BodyRegion | 'ALL') => void;
}

export const BodyMapPanel: React.FC<BodyMapPanelProps> = ({
  items,
  selectedRegion,
  onSelectRegion,
}) => {
  const getRegionStatus = (region: BodyRegion): AlertStatus => {
    const regionItems = items.filter((i) => i.region === region);
    if (regionItems.some((i) => i.status === 'critical')) return 'critical';
    if (regionItems.some((i) => i.status === 'warning')) return 'warning';
    return 'nominal';
  };

  const habitatStatus = getRegionStatus('Habitat panel');

  return (
    <aside className="bg-panel rounded-2xl border border-white/10 shadow-sm p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-brand-light font-semibold">
              Anatomical & Cabin Map
            </span>
            <h2 className="text-base font-bold text-slate-200">Region Filter</h2>
          </div>
          {selectedRegion !== 'ALL' && (
            <button
              onClick={() => onSelectRegion('ALL')}
              className="text-xs font-medium text-brand-light hover:text-white underline cursor-pointer"
            >
              Show all (10)
            </button>
          )}
        </div>

      </div>

      {/* Habitat Panel Card (Cabin CO2 & Radiation) */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <button
          onClick={() =>
            onSelectRegion(selectedRegion === 'Habitat panel' ? 'ALL' : 'Habitat panel')
          }
          className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
            selectedRegion === 'Habitat panel'
              ? 'bg-brand text-white border-brand'
              : 'bg-ink text-white border-ink-soft hover:border-brand-light'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-brand-light flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              Habitat Panel
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                habitatStatus === 'nominal'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-danger/30 text-red-200'
              }`}
            >
              {habitatStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cabin CO₂ & Dosimeter Radiation Telemetry
          </p>
        </button>

        {/* Flight Surgeon Flag Notice */}
        {items.some((i) => i.privateSurgeonFlag) && (
          <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/30 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <div className="text-xs text-slate-200">
              <span className="font-semibold text-danger block">
                Private Flight Surgeon Flag Active
              </span>
              Behavioral health trend flagged confidentially to ground medical officer.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};