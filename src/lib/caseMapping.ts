/**
 * Konvertiert TS-Objekte (camelCase) ↔ DB-Zeilen (snake_case).
 *
 * Wir mappen nur die obersten Keys. JSON-Felder (z. B. `labels`, `checklist`)
 * bleiben unverändert — die werden in der Postgres-Spalte als JSONB abgelegt.
 */

const CACHE_TO_SNAKE = new Map<string, string>();
const CACHE_TO_CAMEL = new Map<string, string>();

export function camelToSnake(s: string): string {
  const cached = CACHE_TO_SNAKE.get(s);
  if (cached) return cached;
  const out = s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  CACHE_TO_SNAKE.set(s, out);
  return out;
}

export function snakeToCamel(s: string): string {
  const cached = CACHE_TO_CAMEL.get(s);
  if (cached) return cached;
  const out = s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  CACHE_TO_CAMEL.set(s, out);
  return out;
}

export function rowToObject<T = unknown>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    out[snakeToCamel(k)] = row[k];
  }
  return out as T;
}

export function objectToRow<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    // Leere Strings + undefined droppen — der Postgres-DEFAULT greift dann
    // (z. B. NULL für `date`-Spalten, '' für `text not null default ''`,
    // 0 für `numeric not null default 0`). Postgres akzeptiert keinen
    // leeren String "" für DATE/NUMERIC. Wer explizit löschen will,
    // schickt `null` — wird durchgeschickt.
    if (v === undefined || v === '') continue;
    out[camelToSnake(k)] = v;
  }
  return out;
}
