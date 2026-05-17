import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DateInputProps {
  /** ISO-Date `YYYY-MM-DD` oder leer. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional: erlaubt nur Daten ab diesem ISO-Datum. */
  min?: string;
  /** Optional: erlaubt nur Daten bis zu diesem ISO-Datum. */
  max?: string;
}

const WEEKDAYS = ['M', 'D', 'M', 'D', 'F', 'S', 'S']; // Mo-So
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromIso(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(iso: string): string {
  const d = fromIso(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

/**
 * Custom DateInput im Brand-Look — ersetzt den nativen <input type="date">.
 * Pill-Trigger + Popover-Kalender, in document.body portaliert, damit das
 * Popover nie vom umliegenden overflow-hidden (z. B. Modal-Container)
 * abgeschnitten wird. Locale: de-DE, Wochenstart Montag.
 */
export function DateInput({ value, onChange, placeholder = 'Datum wählen', className, disabled, min, max }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = useMemo(() => fromIso(value), [value]);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [view, setView] = useState<Date>(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (selected) setView(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selected]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Berechne Popover-Position relativ zum Trigger-Button (im Viewport).
  const updatePos = () => {
    const t = triggerRef.current;
    if (!t) return;
    const rect = t.getBoundingClientRect();
    const popoverHeight = 340; // ungefähre Höhe — wird ggf. nach oben geflippt
    const wouldOverflowBottom = rect.bottom + 8 + popoverHeight > window.innerHeight;
    const top = wouldOverflowBottom ? rect.top - 8 - popoverHeight : rect.bottom + 8;
    setPos({ top, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Click-outside + Escape — checken trigger UND popover
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const monthDays = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const weekdayOfFirst = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - weekdayOfFirst);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [view]);

  const minD = min ? fromIso(min) : null;
  const maxD = max ? fromIso(max) : null;

  const isDisabled = (d: Date) => {
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  };
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isCurrentMonth = (d: Date) => d.getMonth() === view.getMonth();

  const pick = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(toIso(d));
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          'w-full inline-flex items-center justify-between gap-2 rounded-full bg-white border border-[#1e1b4b]/[0.10] px-3.5 py-2.5 text-[13.5px] text-left transition-colors',
          'focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15',
          value ? 'text-[#0f1430]' : 'text-[#1e1b4b]/45',
          disabled && 'opacity-50 cursor-not-allowed',
          'tabular-nums',
          className,
        )}
      >
        <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        <span className="flex items-center gap-1 shrink-0 text-[#1e1b4b]/40">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="size-5 inline-flex items-center justify-center rounded-full hover:bg-[#1e1b4b]/[0.06] text-[#1e1b4b]/45 hover:text-[#0f1430] cursor-pointer"
              aria-label="Datum löschen"
            >
              <X size={11} strokeWidth={2.2} />
            </span>
          )}
          <Calendar size={14} strokeWidth={1.9} />
        </span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] w-[280px] rounded-2xl bg-white border border-[#1e1b4b]/[0.08] shadow-[0_12px_32px_-12px_rgba(15,20,48,0.20)] p-3"
          style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 296) }}
        >
          {/* Header: Monat-Title + Prev/Next */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              className="size-7 rounded-full flex items-center justify-center text-[#1e1b4b]/55 hover:text-[#0f1430] hover:bg-[#1e1b4b]/[0.04]"
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="text-[13px] font-semibold text-[#0f1430] hover:bg-[#1e1b4b]/[0.04] px-2.5 py-1 rounded-full"
              title="Zum aktuellen Monat"
            >
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </button>
            <button
              type="button"
              onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              className="size-7 rounded-full flex items-center justify-center text-[#1e1b4b]/55 hover:text-[#0f1430] hover:bg-[#1e1b4b]/[0.04]"
              aria-label="Nächster Monat"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Wochentag-Labels */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div
                key={i}
                className={cn(
                  'text-center text-[10.5px] font-semibold uppercase tracking-wider py-1',
                  i >= 5 ? 'text-[#1e1b4b]/35' : 'text-[#1e1b4b]/45',
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Tage-Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {monthDays.map((d, i) => {
              const isSel = selected ? isSameDay(d, selected) : false;
              const isTod = isSameDay(d, today);
              const isOut = !isCurrentMonth(d);
              const isDis = isDisabled(d);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => pick(d)}
                  disabled={isDis}
                  className={cn(
                    'h-8 rounded-lg text-[12.5px] font-medium tabular-nums transition-colors',
                    'flex items-center justify-center',
                    isSel
                      ? 'bg-[#4F6BFF] text-white font-bold'
                      : isTod
                        ? 'bg-[#4F6BFF]/10 text-[#4F6BFF] font-semibold'
                        : isOut
                          ? 'text-[#1e1b4b]/25 hover:bg-[#1e1b4b]/[0.03]'
                          : 'text-[#0f1430] hover:bg-[#1e1b4b]/[0.06]',
                    isDis && 'opacity-30 cursor-not-allowed hover:bg-transparent',
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer-Actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1e1b4b]/[0.06]">
            <button
              type="button"
              onClick={() => pick(today)}
              className="text-[11.5px] font-semibold text-[#4F6BFF] hover:bg-[#4F6BFF]/[0.08] px-2.5 py-1 rounded-full"
            >
              Heute
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-[11.5px] font-medium text-[#1e1b4b]/55 hover:text-rose-600 px-2.5 py-1 rounded-full"
              >
                Löschen
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
