import { useEffect, useState } from 'react';
import { HumanModel3D, MODEL_FILES, type BodySex } from './HumanModel3D';
import type { BodyRegion, IndicationItem } from '../data/indicationGroups';

interface ModelPanelProps {
  items: IndicationItem[];
  selectedRegion: BodyRegion | 'ALL';
  onSelectRegion: (region: BodyRegion | 'ALL') => void;
}

const SEX_LABEL: Record<BodySex, string> = { male: 'Male', female: 'Female' };

// Right-side panel with the 3D body model. It fills the height of the screen and
// is only shown when the selected model file is present in public/models.
export function ModelPanel(props: ModelPanelProps) {
  const [sex, setSex] = useState<BodySex>('male');
  const [available, setAvailable] = useState<Record<BodySex, boolean>>({ male: false, female: false });

  useEffect(() => {
    (Object.keys(MODEL_FILES) as BodySex[]).forEach((key) => {
      fetch(MODEL_FILES[key], { method: 'HEAD' })
        .then((res) =>
          setAvailable((prev) => ({
            ...prev,
            [key]: res.ok && !(res.headers.get('content-type') ?? '').includes('text/html'),
          })),
        )
        .catch(() => undefined);
    });
  }, []);

  if (!available.male && !available.female) return null;

  return (
    <aside className="sticky top-20 flex h-[calc(100vh-6rem)] flex-col rounded-2xl border border-white/10 bg-panel p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-brand-light">3D body model</span>
        <div className="flex gap-1">
          {(Object.keys(MODEL_FILES) as BodySex[])
            .filter((key) => available[key])
            .map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSex(key)}
                className={`rounded-md px-2 py-1 text-xs transition-colors cursor-pointer ${
                  sex === key ? 'bg-brand text-white' : 'bg-ink-soft text-slate-300 hover:text-white'
                }`}
              >
                {SEX_LABEL[key]}
              </button>
            ))}
        </div>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">Click a marker to filter by body region</p>
      {/* key remounts the 3D view when the body type changes */}
      <HumanModel3D key={sex} sex={sex} {...props} />
    </aside>
  );
}
