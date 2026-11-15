// Code was assisted with Claude.
import { AlertTriangle, PhoneCall, X } from 'lucide-react';
import type { IndicatorInfo } from '../../../api/healthApi';
import { ATTENTION_GUIDE } from '../data/attentionGuide';

// One indicator that needs attention, as shown in the guide.
export interface AttentionItem {
  indicatorId: string;
  name: string;
  status: 'warning' | 'critical';
  message?: string;
}

interface AttentionGuideProps {
  items: AttentionItem[];
  rules: Record<string, IndicatorInfo>;
  onClose: () => void;
}

// Text like "celsius 36.1-37.5" from the backend's normal ranges.
function normalRangeText(info: IndicatorInfo | undefined): string | null {
  if (!info) return null;
  const parts = Object.entries(info.values).map(([key, rule]) => `${key} ${rule.normal[0]}–${rule.normal[1]}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

// A dialog that explains, for each indicator that needs attention, what to do to bring it back to normal.
export function AttentionGuide({ items, rules, onClose }: AttentionGuideProps) {
  const anyUrgent = items.some((item) => item.status === 'critical');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="attention-title">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-panel shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <h2 id="attention-title" className="text-lg font-bold text-slate-200">What to do now</h2>
            <p className="mt-1 text-xs text-slate-400">
              {items.length === 0
                ? 'All your indicators are within the normal range. Nothing needs to be done.'
                : `${items.length} indicator${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} attention. Follow the steps for each one.`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close guide" className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {anyUrgent && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-slate-200">
              <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <span>
                <strong className="text-danger">Urgent:</strong> contact the flight surgeon now for every alert below.
              </span>
            </div>
          )}

          {items.map((item) => {
            const steps = ATTENTION_GUIDE[item.indicatorId]
            const urgent = item.status === 'critical'
            const range = normalRangeText(rules[item.indicatorId])
            return (
              <section key={item.indicatorId} className="rounded-xl border border-white/10 bg-ink-soft/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-200">{item.name}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgent ? 'bg-danger/15 text-danger' : 'bg-amber-500/15 text-amber-300'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {urgent ? 'Alert' : 'Trend Watch'}
                  </span>
                </div>
                {item.message && <p className="mt-2 text-xs text-slate-300">{item.message}</p>}
                {range && <p className="mt-1 text-[11px] text-slate-400">Normal range: {range}</p>}

                {steps ? (
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
                    {(urgent ? steps.urgent : steps.caution).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Contact the flight surgeon for advice on this indicator.</p>
                )}
              </section>
            )
          })}

          <p className="text-[11px] text-slate-500">
            These are general steps. The mission procedures and the flight surgeon always come first.
          </p>
        </div>
      </div>
    </div>
  );
}
