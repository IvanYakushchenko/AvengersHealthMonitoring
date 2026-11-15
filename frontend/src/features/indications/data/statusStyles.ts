// Code was assisted with Claude.
import type { AlertStatus } from './indicationGroups'

// The colours for each status. The palette is deliberately soft. Red is used only for
// 'critical' (an emergency). Everything else uses calm green, amber, or grey.

export const STATUS_LABEL: Record<AlertStatus, string> = {
  nominal: 'Nominal',
  warning: 'Trend Watch',
  critical: 'Alert',
  unknown: 'No data',
}

// Small pill shown on a card or a panel.
export const STATUS_BADGE: Record<AlertStatus, string> = {
  nominal: 'bg-emerald-400/10 text-emerald-200/90 ring-1 ring-emerald-400/20',
  warning: 'bg-amber-300/10 text-amber-200/90 ring-1 ring-amber-300/20',
  critical: 'bg-danger/20 text-red-200 ring-1 ring-danger/40',
  unknown: 'bg-white/5 text-slate-400 ring-1 ring-white/10',
}

// The dot next to a region button.
export const STATUS_DOT: Record<AlertStatus, string> = {
  nominal: 'bg-emerald-400/70',
  warning: 'bg-amber-300/70',
  critical: 'bg-danger',
  unknown: 'bg-slate-600',
}

// The border of a card.
export const CARD_BORDER: Record<AlertStatus, string> = {
  nominal: 'border-white/10',
  warning: 'border-amber-300/25',
  critical: 'border-danger/40',
  unknown: 'border-white/10',
}
