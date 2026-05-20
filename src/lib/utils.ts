import type { AppMode } from '../types';

export function generateId(): string {
  // UUID v4 — passt zur Supabase `uuid`-Spalte. crypto.randomUUID ist in
  // allen aktuellen Browsern vorhanden (Vite-Targets).
  return crypto.randomUUID();
}

/**
 * Liest das vom Nutzer in den Einstellungen gewählte Standard-Dashboard.
 * Fallback-Kette: explizite Wahl → zuletzt aktiver Modus → `'buyhold'` als sinnvoller Default.
 */
export function getDefaultDashboard(): AppMode {
  const explicit = localStorage.getItem('immofreak_default_dashboard');
  if (explicit === 'fixflip' || explicit === 'buyhold') return explicit;
  const legacy = localStorage.getItem('immofreak_mode');
  if (legacy === 'fixflip') return 'fixflip';
  return 'buyhold';
}

/**
 * Mappt den Dashboard-Modus auf den zugehörigen Route-Pfad.
 */
export function getDashboardRoute(mode: AppMode): string {
  return mode === 'fixflip' ? '/' : '/bh';
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '–';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '–';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Dezimalformat (de-DE) für Beträge ohne Währungssymbol — Ersatz für lokal
 * definierte `fmt`-Helper, die identisch in 6 Komponenten standen.
 */
export function formatDecimal(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0,00';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/* IBAN-Validierung steht weiter unten — `isValidIBAN` war bereits vorhanden. */

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Akquise: 'bg-blue-100 text-blue-700',
    Planung: 'bg-blue-100 text-blue-700',
    Sanierung: 'bg-yellow-100 text-yellow-700',
    Verkauf: 'bg-teal-100 text-teal-700',
    Abgeschlossen: 'bg-gray-100 text-gray-600',
    geplant: 'bg-gray-100 text-gray-600',
    beauftragt: 'bg-blue-100 text-blue-700',
    abgeschlossen: 'bg-teal-100 text-teal-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-600';
}

export function getBudgetPercentage(spent: number, total: number): { percentage: number; color: string } {
  if (total === 0) return { percentage: 0, color: 'bg-gray-300' };
  const percentage = Math.round((spent / total) * 100);
  let color = 'bg-teal-500';
  if (percentage > 90) color = 'bg-red-500';
  else if (percentage > 75) color = 'bg-yellow-500';
  return { percentage: Math.min(percentage, 100), color };
}

/**
 * Effektive Sanierungskosten eines Fix-&-Flip-Projekts.
 *
 * `renovationBudget` ist der vom Nutzer eingetragene Plan-Wert, `actualSpent`
 * die Summe aller `actualCost`-Werte aus den Budget-Items. Für die Gewinn-
 * Projektion nehmen wir das **Maximum** beider Werte — so zeigen wir immer
 * die konservativere (= realistischere) Zahl:
 *   - Keine Items erfasst → Plan-Budget (sonst erschiene der Gewinn künstlich hoch).
 *   - Ist-Kosten unter Plan → Plan bleibt relevant (Projekt ist nicht fertig).
 *   - Ist-Kosten über Plan → Ist-Kosten übernehmen (Realität hat Plan überholt).
 *
 * Dadurch reagiert der angezeigte Gewinn live auf neu erfasste Budget-Items,
 * sobald sie das Plan-Budget übersteigen.
 */
export function effectiveRenovationCost(renovationBudget: number, actualSpent: number): number {
  return Math.max(renovationBudget, actualSpent);
}

/**
 * Projizierter Gewinn eines Fix-&-Flip-Projekts:
 *   Verkaufsziel − Kaufpreis − effektive Sanierungskosten
 * (siehe {@link effectiveRenovationCost}).
 */
export function calculateProjectedProfit(
  targetSellPrice: number,
  purchasePrice: number,
  renovationBudget: number,
  actualSpent: number,
): number {
  return targetSellPrice - purchasePrice - effectiveRenovationCost(renovationBudget, actualSpent);
}

/**
 * IBAN-Validierung nach ISO 13616 (mod-97-Prüfung).
 * - Entfernt alle Whitespaces
 * - Prüft Länge gegen Landes-spezifische Vorgabe (22 für DE, variable für andere)
 * - Verlagert die ersten 4 Zeichen ans Ende
 * - Wandelt Buchstaben in Zahlen (A=10, B=11, …, Z=35)
 * - Berechnet mod 97 — muss 1 ergeben, sonst ungültig
 *
 * Referenz: https://en.wikipedia.org/wiki/International_Bank_Account_Number#Validating_the_IBAN
 */
const IBAN_LENGTHS: Record<string, number> = {
  DE: 22, AT: 20, CH: 21, LI: 21, FR: 27, IT: 27, ES: 24, NL: 18, BE: 16,
  LU: 20, IE: 22, PT: 25, FI: 18, DK: 18, SE: 24, NO: 15, PL: 28, CZ: 24,
  SK: 24, HU: 28, GB: 22,
};

export function isValidIBAN(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;

  const countryCode = iban.slice(0, 2);
  const expectedLen = IBAN_LENGTHS[countryCode];
  if (expectedLen && iban.length !== expectedLen) return false;

  // Rearrange: Move first 4 chars to the end
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  // Convert letters to numbers
  const numeric = rearranged.split('').map((c) => {
    const code = c.charCodeAt(0);
    if (code >= 48 && code <= 57) return c; // 0-9
    if (code >= 65 && code <= 90) return String(code - 55); // A-Z → 10-35
    return '';
  }).join('');

  // Piecewise mod 97 (IBANs can exceed JavaScript's safe integer range)
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder === 1;
}
