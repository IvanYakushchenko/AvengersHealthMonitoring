import { Layers } from 'lucide-react';
import type { AlertStatus, BodyRegion, IndicationItem } from '../data/indicationGroups';

const REGIONS: { id: BodyRegion; label: string }[] = [
  { id: 'Head', label: 'Head (Sleep / Mood)' },
  { id: 'Eyes', label: 'Eyes (SANS Vision)' },
  { id: 'Heart', label: 'Heart (HR / BP)' },
  { id: 'Lungs', label: 'Lungs (SpO₂)' },
  { id: 'Whole body', label: 'Whole Body (Temp)' },
  { id: 'Legs and spine', label: 'Legs & Spine (Exercise)' },
];

interface RegionFiltersProps {
  items: IndicationItem[];
  selectedRegion: BodyRegion | 'ALL';
  onSelectRegion: (region: BodyRegion | 'ALL') => void;
}

function regionStatus(items: IndicationItem[], region: BodyRegion): AlertStatus {
  const regional = items.filter((i) => i.region === region);
  if (regional.some((i) => i.status === 'critical')) return 'critical';
  if (regional.some((i) => i.status === 'warning')) return 'warning';
  return 'nominal';
}

// Region quick-select buttons, shown under the 3D model.
export function RegionFilters({ items, selectedRegion, onSelectRegion }: RegionFiltersProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {REGIONS.map((reg) => {
        const status = regionStatus(items, reg.id);
        const isSelected = selectedRegion === reg.id;
        return (
          <button
            key={reg.id}
            type="button"
            onClick={() => onSelectRegion(isSelected ? 'ALL' : reg.id)}
            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              isSelected ? 'bg-brand text-white' : 'bg-white/5 hover:bg-white/10 text-slate-200'
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Layers className="w-3 h-3 shrink-0 opacity-75" />
              <span className="truncate">{reg.label}</span>
            </span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                status === 'critical' ? 'bg-danger' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
