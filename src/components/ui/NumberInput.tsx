import { forwardRef, useEffect, useRef, useState } from 'react';

/**
 * NumberInput — deutsches Zahlenformat für Geld, Prozente, Mengen.
 *
 * Der User sieht `10.000` bzw. `10.000,50`, die Komponente gibt an das Parent
 * aber den reinen `number` (oder `''` bei leer) zurück. Dadurch bleiben
 * bestehende Form-States bis auf den Typ des State-Werts kompatibel.
 *
 * Warum `type="text"` statt `type="number"`:
 *   - `type="number"` erlaubt keine Tausender-Punkte und würde sie verschlucken
 *   - `inputMode="decimal"` / `"numeric"` sorgt trotzdem für die passende
 *     Mobile-Tastatur
 *
 * Formatierungs-Strategie:
 *   - Beim Tippen: Tausenderpunkte werden live gesetzt, der Caret folgt
 *     den Ziffern (nicht der String-Position), damit Einfügen in der Mitte
 *     nicht „springt".
 *   - Beim Blur: Reformatierung auf die kanonische Form mit `decimals`-Stellen
 *     (Nachkomma wird bei Geld nicht aufgefüllt, nur gekappt).
 */
export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: number | string | null | undefined;
  onChange: (value: number | '') => void;
  /** Angehängtes Kürzel wie `€`, `%`, `m²` — wird rechts innerhalb des Inputs gerendert. */
  suffix?: string;
  /** Erlaubte Nachkommastellen. 0 = nur ganze Zahlen (kein Komma). Default: 0. */
  decimals?: number;
  allowNegative?: boolean;
}

function toNumberOrEmpty(v: number | string | null | undefined): number | '' {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : '';
}

/** Zahl → deutsches Format. `minimumFractionDigits: 0`, damit `10000` als `10.000` erscheint (nicht `10.000,00`). */
function formatDe(num: number | '', decimals: number): string {
  if (num === '') return '';
  return num.toLocaleString('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
}

/** User-Input (z. B. `"10.000,50"` oder `"10000,5"`) → Zahl. */
function parseDe(str: string): number | '' {
  const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-') return '';
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : '';
}

/** Während-Tippen-Formatter: setzt Tausenderpunkte im Integer-Teil, lässt Dezimal-Komma unverändert. */
function liveFormat(raw: string): string {
  if (!raw) return '';
  const minus = raw.startsWith('-') ? '-' : '';
  const body = minus ? raw.slice(1) : raw;
  const [intPart, decPart] = body.split(',');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return minus + intFormatted + (decPart !== undefined ? ',' + decPart : '');
}

/** Zählt Ziffern (0–9) in einem String. Wir nutzen das, um den Caret anhand der Ziffer-Position zu restorieren. */
function countDigits(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) n++;
  }
  return n;
}

/** Findet die String-Position nach der n-ten Ziffer (von links). Dient zur Caret-Wiederherstellung nach Reformat. */
function positionAfterDigit(s: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return s.length;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onChange, suffix, decimals = 0, allowNegative = false, className = '', onBlur, onFocus, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  const normalized = toNumberOrEmpty(value);
  const [display, setDisplay] = useState(() => formatDe(normalized, decimals));
  const focusedRef = useRef(false);

  // Externer Value-Update (z. B. Defaults aus Settings, Auto-Fill) — nicht während Fokus,
  // sonst würde der Caret ständig verloren gehen.
  useEffect(() => {
    if (focusedRef.current) return;
    setDisplay(formatDe(normalized, decimals));
  }, [normalized, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;

    // Erlaubte Zeichen aufräumen
    const allowedPattern = decimals > 0
      ? (allowNegative ? /[^\d,-]/g : /[^\d,]/g)
      : (allowNegative ? /[^\d-]/g : /\D/g);
    raw = raw.replace(allowedPattern, '');

    if (allowNegative) {
      const hasMinus = raw.includes('-');
      raw = raw.replace(/-/g, '');
      if (hasMinus) raw = '-' + raw;
    }

    if (decimals > 0) {
      // Nur ein Komma erlauben
      const first = raw.indexOf(',');
      if (first !== -1) {
        raw = raw.slice(0, first + 1) + raw.slice(first + 1).replace(/,/g, '');
      }
      // Nachkomma-Stellen kappen
      const parts = raw.split(',');
      if (parts.length === 2 && parts[1].length > decimals) {
        raw = parts[0] + ',' + parts[1].slice(0, decimals);
      }
    }

    // Ziffern vor dem ursprünglichen Caret zählen, um später dahinter zu restorieren
    const digitsBeforeCaret = countDigits(e.target.value.slice(0, caret));

    const formatted = liveFormat(raw);
    setDisplay(formatted);

    const parsed = parseDe(formatted);
    onChange(parsed);

    // Caret nach dem Render wiederherstellen (nach React-Update)
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el || document.activeElement !== el) return;
      const target = positionAfterDigit(formatted, digitsBeforeCaret);
      try {
        el.setSelectionRange(target, target);
      } catch {
        /* ignore — inputs wie <input type="text"> unterstützen das, aber sicherheitshalber */
      }
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false;
    const parsed = parseDe(display);
    setDisplay(formatDe(parsed, decimals));
    onBlur?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    onFocus?.(e);
  };

  const inputEl = (
    <input
      {...rest}
      ref={setRef}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className={`${className}${suffix ? ' pr-10' : ''}`.trim()}
    />
  );

  if (!suffix) return inputEl;
  return (
    <div className="relative">
      {inputEl}
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        {suffix}
      </span>
    </div>
  );
});
