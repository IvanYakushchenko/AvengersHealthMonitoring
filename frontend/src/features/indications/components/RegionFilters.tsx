// Code was assisted with Claude.
import { Layers } from 'lucide-react';
import { aggregateStatus, type AlertStatus, type BodyRegion, type IndicationItem } from '../data/indicationGroups';

// The six region buttons under the 3D model, with the indicators each one filters.
const REGIONS: { id: BodyRegion; label: string }[] = [
  { id: 'Head', label: 'Head (Sleep / Mood)' },
  { id: 'Eyes', label: 'Eyes (SANS Vision)' },
  { id: 'Heart', label: 'Heart (HR / BP)' },
  { id: 'Lungs', label: 'Lungs (SpO₂)' },
  { id: 'Whole body', label: 'Whole Body (Temp)' },
  { id: 'Legs and spine', label: 'Legs & Spine (Exercise)' },
];

// Props of the region buttons: the indicators, the selected region and the callback.
interface RegionFiltersProps {
  items: IndicationItem[];
  selectedRegion: BodyRegion | 'ALL';
  onSelectRegion: (region: BodyRegion | 'ALL') => void;
}

// The worst status of the indicators in one region (drives the coloured dot).
function regionStatus(items: IndicationItem[], region: BodyRegion): AlertStatus {
  return aggregateStatus(items.filter((i) => i.region === region));
}

// The colour of the status dot for each status.
const DOT_CLASS: Record<AlertStatus, string> = {
  critical: 'bg-danger',
  warning: 'bg-amber-500',
  nominal: 'bg-emerald-500',
  unknown: 'bg-slate-500',
};

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
              className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[status]}`}
            />
          </button>
        );
      })}
    </div>
  );
}
