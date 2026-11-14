import React, { useEffect, useRef } from 'react';
import { ShieldAlert, Radio, Layers } from 'lucide-react';
import { animate } from 'animejs';
import { type AlertStatus, type BodyRegion, type IndicationItem } from '../data/indicationGroups';

interface BodyMapPanelProps {
  items: IndicationItem[];
  selectedRegion: BodyRegion | 'ALL';
  onSelectRegion: (region: BodyRegion | 'ALL') => void;
}

const REGIONS: { id: BodyRegion; label: string; cx: number; cy: number }[] = [
  { id: 'Head', label: 'Head (Sleep / Mood)', cx: 110, cy: 36 },
  { id: 'Eyes', label: 'Eyes (SANS Vision)', cx: 122, cy: 46 },
  { id: 'Heart', label: 'Heart (HR / BP)', cx: 118, cy: 96 },
  { id: 'Lungs', label: 'Lungs (SpO₂)', cx: 98, cy: 92 },
  { id: 'Whole body', label: 'Whole Body (Temp)', cx: 145, cy: 130 },
  { id: 'Legs and spine', label: 'Legs & Spine (Exercise)', cx: 110, cy: 185 },
];

export const BodyMapPanel: React.FC<BodyMapPanelProps> = ({
  items,
  selectedRegion,
  onSelectRegion,
}) => {
  const pulseRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (pulseRef.current) {
      animate(pulseRef.current.querySelectorAll('.alert-ring'), {
        scale: [1, 1.8],
        opacity: [0.85, 0],
        duration: 1600,
        loop: true,
        ease: 'outQuad',
      });
    }
  }, [items]);

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

        {/* Interactive SVG Astronaut Silhouette */}
        <div className="relative bg-night rounded-xl p-4 flex flex-col items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 220 270"
            className="w-full max-w-[210px] h-auto select-none"
            aria-label="Crew Body Map"
          >
            {/* Subtle Grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="rgba(91, 143, 214, 0.12)"
                  strokeWidth="0.7"
                />
              </pattern>
            </defs>
            <rect width="220" height="270" fill="url(#grid)" rx="8" />

            {/* Stylized Human Silhouette */}
            <g
              fill="rgba(91, 143, 214, 0.14)"
              stroke="#5b8fd6"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              {/* Head */}
              <circle cx="110" cy="40" r="20" />
              {/* Torso */}
              <path d="M 80 72 Q 110 64 140 72 L 134 148 L 86 148 Z" />
              {/* Left & Right Arms */}
              <path d="M 76 74 L 54 138 L 65 142 L 82 88" />
              <path d="M 144 74 L 166 138 L 155 142 L 138 88" />
              {/* Spine Line */}
              <line
                x1="110"
                y1="68"
                x2="110"
                y2="148"
                strokeDasharray="3 3"
                stroke="#5b8fd6"
              />
              {/* Legs */}
              <path d="M 87 150 L 82 245 L 98 245 L 106 165 L 114 165 L 122 245 L 138 245 L 133 150 Z" />
            </g>

            {/* Interactive Hotspots */}
            <g ref={pulseRef}>
              {REGIONS.map((reg) => {
                const status = getRegionStatus(reg.id);
                const isSelected = selectedRegion === reg.id;
                const dotColor =
                  status === 'critical'
                    ? '#c62828'
                    : status === 'warning'
                    ? '#f59e0b'
                    : '#10b981';

                return (
                  <g
                    key={reg.id}
                    onClick={() => onSelectRegion(isSelected ? 'ALL' : reg.id)}
                    className="cursor-pointer group"
                  >
                    {status !== 'nominal' && (
                      <circle
                        cx={reg.cx}
                        cy={reg.cy}
                        r={10}
                        fill="none"
                        stroke={dotColor}
                        strokeWidth="1.5"
                        className="alert-ring origin-center"
                        style={{ transformBox: 'fill-box' }}
                      />
                    )}
                    <circle
                      cx={reg.cx}
                      cy={reg.cy}
                      r={isSelected ? 8 : 6}
                      fill={dotColor}
                      stroke="#ffffff"
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          <span className="text-[11px] font-mono text-slate-400 mt-1">
            Click anatomical node to filter
          </span>
        </div>

        {/* Region Quick-Select Pills */}
        <div className="mt-4 space-y-1.5">
          {REGIONS.map((reg) => {
            const status = getRegionStatus(reg.id);
            const isSelected = selectedRegion === reg.id;
            return (
              <button
                key={reg.id}
                onClick={() => onSelectRegion(isSelected ? 'ALL' : reg.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-brand text-white'
                    : 'bg-white/5 hover:bg-slate-200/70 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 opacity-75" />
                  {reg.label}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === 'critical'
                      ? 'bg-danger'
                      : status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </button>
            );
          })}
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