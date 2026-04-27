/**
 * Grunderwerbsteuer-Sätze pro Bundesland (Stand 2024/2025).
 *
 * Quellen & wichtige Änderungen der letzten Jahre:
 * - Bayern: 3,5 % (einziges Bundesland mit dem ursprünglichen Bundessatz)
 * - Sachsen: +2 pp auf 5,5 % zum 01.01.2023
 * - Hamburg: +1 pp auf 5,5 % zum 01.01.2023
 * - Thüringen: −1,5 pp auf 5,0 % zum 01.01.2024 (Familienfreundlichkeit)
 *
 * Hinweis für Nutzer: Einige Bundesländer gewähren Freibeträge oder ermäßigte
 * Sätze (z. B. für Familien mit Kindern, erstes Eigenheim). Das bildet diese
 * Tabelle nicht ab — sie liefert nur den Standard-Satz für Investoren.
 */
export interface Bundesland {
  code: string;
  name: string;
  /** Grunderwerbsteuer in Prozent */
  grunderwerbsteuer: number;
}

export const BUNDESLAENDER: Bundesland[] = [
  { code: 'BW', name: 'Baden-Württemberg', grunderwerbsteuer: 5.0 },
  { code: 'BY', name: 'Bayern', grunderwerbsteuer: 3.5 },
  { code: 'BE', name: 'Berlin', grunderwerbsteuer: 6.0 },
  { code: 'BB', name: 'Brandenburg', grunderwerbsteuer: 6.5 },
  { code: 'HB', name: 'Bremen', grunderwerbsteuer: 5.0 },
  { code: 'HH', name: 'Hamburg', grunderwerbsteuer: 5.5 },
  { code: 'HE', name: 'Hessen', grunderwerbsteuer: 6.0 },
  { code: 'MV', name: 'Mecklenburg-Vorpommern', grunderwerbsteuer: 6.0 },
  { code: 'NI', name: 'Niedersachsen', grunderwerbsteuer: 5.0 },
  { code: 'NW', name: 'Nordrhein-Westfalen', grunderwerbsteuer: 6.5 },
  { code: 'RP', name: 'Rheinland-Pfalz', grunderwerbsteuer: 5.0 },
  { code: 'SL', name: 'Saarland', grunderwerbsteuer: 6.5 },
  { code: 'SN', name: 'Sachsen', grunderwerbsteuer: 5.5 },
  { code: 'ST', name: 'Sachsen-Anhalt', grunderwerbsteuer: 5.0 },
  { code: 'SH', name: 'Schleswig-Holstein', grunderwerbsteuer: 6.5 },
  { code: 'TH', name: 'Thüringen', grunderwerbsteuer: 5.0 },
];

/**
 * Notar + Grundbuch: branchenübliche Spanne 1,5–2,0 %. Wir setzen 1,5 % als
 * realistischen Default — bei höheren Kaufpreisen ist die relative Notarlast
 * tendenziell niedriger.
 */
export const DEFAULT_NOTAR_PCT = 1.5;

/**
 * Makler-Courtage (inkl. USt): Seit Bestellerprinzip 2020 oft hälftig geteilt,
 * Käuferanteil max. 3,57 % (3,0 % + 19 % USt).
 */
export const DEFAULT_MAKLER_PCT = 3.57;

/**
 * Standard-Bundesland, falls der Nutzer noch nichts gewählt hat. Berlin ist
 * pragmatisch: hoher Marktanteil bei Investoren und 6 % entsprechen dem
 * bundesweiten Mittelwert.
 */
export const DEFAULT_BUNDESLAND_CODE = 'BE';

export function getBundeslandByCode(code: string): Bundesland | undefined {
  return BUNDESLAENDER.find((b) => b.code === code);
}

/**
 * Gesamt-Kaufnebenkosten in Prozent für ein Bundesland. Rechnet GrESt +
 * Notar + (optional) Makler zusammen. Makler ist parametrisiert, weil manche
 * Käufer ohne Makler kaufen (Direktkauf, Bestandsdeal).
 */
export function getTotalNebenkostenPct(
  bundeslandCode: string,
  notarPct = DEFAULT_NOTAR_PCT,
  maklerPct = DEFAULT_MAKLER_PCT,
): number {
  const bl = getBundeslandByCode(bundeslandCode);
  if (!bl) return 0;
  return bl.grunderwerbsteuer + notarPct + maklerPct;
}
