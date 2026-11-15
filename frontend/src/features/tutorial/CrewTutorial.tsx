// Code was assisted with Claude.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// One step of the tutorial: a short title and the text.
interface Step {
  title: string;
  body: string;
}

// The main functions of the crew page, in the order a new crew member meets them.
export const TUTORIAL_STEPS: Step[] = [
  {
    title: 'Welcome',
    body: 'This is your health page. It shows your own measurements and how they are rated. This quick tour takes about a minute.',
  },
  {
    title: 'Your indicators',
    body: 'Each card is one measurement, such as heart rate or sleep. The badge shows the rating: Nominal (green), Trend Watch (amber), Alert (red), or No data (grey until you log one).',
  },
  {
    title: 'Log a reading',
    body: 'Press Log on a card, fill in the fields, and press Save reading. The allowed range is shown under each field. The rating and a short message appear straight away.',
  },
  {
    title: 'Correct or delete',
    body: 'If you typed a wrong value, press Correct to change your newest reading, or Delete to remove it. Both ask you to confirm first where it matters.',
  },
  {
    title: 'Body map and filter',
    body: 'The 3D model shows your body. Press a marker or a region button to show only the cards for that body area. Press Show all or Reset filter to see everything again.',
  },
  {
    title: 'Streak and points',
    body: 'The header counts the days in a row you have logged something (streak) and your total points. Logging regularly keeps the streak going.',
  },
  {
    title: 'Account',
    body: 'Use Password in the header to change your password. Logout ends your session. You can open this tour again at any time with the Tutorial button.',
  },
];

// Props of the tutorial: called when it is closed, by Skip, Finish or Escape.
interface CrewTutorialProps {
  onClose: () => void;
}

// A step-by-step tour of the crew page. It can be skipped at any step.
export function CrewTutorial({ onClose }: CrewTutorialProps) {
  const [index, setIndex] = useState(0);
  const step = TUTORIAL_STEPS[index];
  const isLast = index === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-brand-light">
            Step {index + 1} of {TUTORIAL_STEPS.length}
          </span>
          <button type="button" onClick={onClose} aria-label="Close tutorial" className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 id="tutorial-title" className="mt-2 text-lg font-bold text-slate-200">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {TUTORIAL_STEPS.map((s, i) => (
            <span key={s.title} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-brand-light' : 'bg-white/20'}`} />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white cursor-pointer">
            Skip tutorial
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-ink-soft border border-white/10 text-xs font-medium text-slate-200 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setIndex(index + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-dark cursor-pointer"
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
