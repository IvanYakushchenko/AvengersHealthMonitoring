import { useEffect, useState } from 'react';
import { HumanModel3D, MODEL_FILES, type BodySex } from './HumanModel3D';
import type { BodyRegion, IndicationItem } from '../data/indicationGroups';
import { RegionFilters } from './RegionFilters';

interface ModelPanelProps {
  // The crew member's sex picks the model. null (no sex on the account) shows the male model.
  sex: BodySex | null;
  items: IndicationItem[];
  selectedRegion: BodyRegion | 'ALL';
  onSelectRegion: (region: BodyRegion | 'ALL') => void;
}

const SEX_LABEL: Record<BodySex, string> = { male: 'Male', female: 'Female' };

// Right-side panel with the 3D body model. It fills the height of the screen and
// is only shown when the model file for this sex is present in public/models.
export function ModelPanel({ sex, items, selectedRegion, onSelectRegion }: ModelPanelProps) {
  const model: BodySex = sex ?? 'male';
  const [checked, setChecked] = useState<{ sex: BodySex; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_FILES[model], { method: 'HEAD' })
      .then((res) => {
        if (!cancelled)
          setChecked({
            sex: model,
            ok: res.ok && !(res.headers.get('content-type') ?? '').includes('text/html'),
          });
      })
      .catch(() => {
        if (!cancelled) setChecked({ sex: model, ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, [model]);

  const available = checked?.sex === model && checked.ok;
  if (!available) return null;

  return (
    <aside className="sticky top-20 flex h-[calc(100vh-6rem)] flex-col rounded-2xl border border-white/10 bg-panel p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-brand-light">3D body model</span>
        <span className="rounded-md bg-ink-soft px-2 py-1 text-xs text-slate-300">{SEX_LABEL[model]}</span>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">Click a marker to filter by body region</p>
      {/* key remounts the 3D view when the body type changes */}
      <HumanModel3D key={model} sex={model} items={items} selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} />
      <div className="mt-3">
        <RegionFilters items={items} selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} />
      </div>
    </aside>
  );
}
