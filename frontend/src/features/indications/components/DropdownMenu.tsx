// Code was assisted with Claude.
import { useEffect, useRef, useState, type ReactNode } from 'react';

// One entry in the menu.
export interface MenuItem {
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  onSelect: () => void;
}

interface DropdownMenuProps {
  // What the button shows (text, icon, or both).
  trigger: ReactNode;
  // Read by screen readers, because the trigger may be only an icon.
  ariaLabel: string;
  items: MenuItem[];
  // Which edge of the button the menu opens from.
  align?: 'left' | 'right';
  // Optional extra classes for the trigger button.
  triggerClassName?: string;
}

// A small menu that opens under a button. It closes after a choice, on a click outside
// it, or with the Escape key.
export function DropdownMenu({ trigger, ariaLabel, items, align = 'right', triggerClassName = '' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-slate-100 cursor-pointer ${triggerClassName}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-1.5 min-w-[13rem] overflow-hidden rounded-lg border border-white/10 bg-panel py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.06] hover:text-slate-100 cursor-pointer"
            >
              <span className="text-slate-400">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
