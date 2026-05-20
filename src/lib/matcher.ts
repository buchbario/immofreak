import type {
  BankTransaction,
  MatchStatus,
  RentalContract,
  RentalUnit,
  Tenant,
  TenantPaymentMapping,
} from '../types';

export interface MatchContext {
  tenants: Tenant[];
  units: RentalUnit[];
  contracts: RentalContract[];
  mappings: TenantPaymentMapping[];
}

export interface MatchResult {
  tenantId?: string;
  propertyId?: string;
  // null-tolerant — Tenant.unitId ist nullable (DB-Schema), gleiche FK auf Match-Result durchgereicht.
  unitId?: string | null;
  status: MatchStatus;
  confidence: number;
  reason: string;
}

const AMOUNT_TOLERANCE = 0.5;

/**
 * Normalisiert einen Counterparty-String:
 * - NFD-Strip Diakritika (ä → a, é → e, ß → ss)
 * - Lowercase
 * - Nicht-alphanumerische Zeichen → Leerzeichen
 * - Mehrfach-Whitespace kollabiert
 */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter((t) => t.length >= 2);
}

function normalizeIban(iban: string | null | undefined): string | undefined {
  if (!iban) return undefined;
  return iban.toUpperCase().replace(/\s+/g, '');
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

function tenantContext(tenant: Tenant, ctx: MatchContext) {
  const unit = ctx.units.find((u) => u.id === tenant.unitId);
  return {
    propertyId: tenant.propertyId,
    unitId: tenant.unitId,
    expectedRent: unit?.currentRent ?? 0,
  };
}

/**
 * Liefert die Match-Entscheidung für eine Transaktion.
 *
 * Reihenfolge (jeweils early-return bei Treffer):
 *  1. Gelerntes IBAN-Mapping       → auto (0.99)
 *  2. IBAN direkt am Tenant        → auto (0.95)
 *  3. Gelerntes Name-Mapping       → auto (0.90)
 *  4. Betrag = Miete + Name-Token  → suggested (0.70)
 *  5. Betrag = Kaution + offen     → suggested (0.60)
 *  6. sonst                        → unmatched
 *
 * Wird nur auf Eingänge (amount > 0) angewendet. Ausgaben sind keine Mietzahlungen.
 */
export function matchTransaction(tx: BankTransaction, ctx: MatchContext): MatchResult {
  if (tx.amount <= 0) {
    return { status: 'unmatched', confidence: 0, reason: 'outgoing' };
  }
  if (tx.isIgnored) {
    return { status: 'unmatched', confidence: 0, reason: 'ignored' };
  }

  const txIban = normalizeIban(tx.iban);
  const txTokens = tokenize(tx.counterparty);
  const txTokenSet = new Set(txTokens);

  // 1. IBAN-Mapping
  if (txIban) {
    const mapping = ctx.mappings.find((m) => normalizeIban(m.iban) === txIban);
    if (mapping) {
      const tenant = ctx.tenants.find((t) => t.id === mapping.tenantId);
      if (tenant) {
        const meta = tenantContext(tenant, ctx);
        return {
          tenantId: tenant.id,
          propertyId: meta.propertyId,
          unitId: meta.unitId,
          status: 'auto',
          confidence: 0.99,
          reason: 'iban-mapping',
        };
      }
    }
  }

  // 2. IBAN direkt am Tenant
  if (txIban) {
    const tenant = ctx.tenants.find((t) => normalizeIban(t.iban) === txIban);
    if (tenant) {
      const meta = tenantContext(tenant, ctx);
      return {
        tenantId: tenant.id,
        propertyId: meta.propertyId,
        unitId: meta.unitId,
        status: 'auto',
        confidence: 0.95,
        reason: 'tenant-iban',
      };
    }
  }

  // 3. Gelerntes Name-Mapping (exakter normalisierter Treffer)
  const txName = normalize(tx.counterparty);
  if (txName) {
    const mapping = ctx.mappings.find(
      (m) => m.counterpartyName && normalize(m.counterpartyName) === txName,
    );
    if (mapping) {
      const tenant = ctx.tenants.find((t) => t.id === mapping.tenantId);
      if (tenant) {
        const meta = tenantContext(tenant, ctx);
        return {
          tenantId: tenant.id,
          propertyId: meta.propertyId,
          unitId: meta.unitId,
          status: 'auto',
          confidence: 0.9,
          reason: 'name-mapping',
        };
      }
    }
  }

  // 4. Betrag = currentRent + Name-Token-Overlap
  const rentCandidates = ctx.tenants
    .filter((t) => t.unitId)
    .map((tenant) => {
      const meta = tenantContext(tenant, ctx);
      if (!amountsMatch(tx.amount, meta.expectedRent) || meta.expectedRent <= 0) return null;
      const tenantTokens = tokenize(tenant.name);
      const overlap = tenantTokens.filter((t) => txTokenSet.has(t)).length;
      return { tenant, meta, overlap };
    })
    .filter((c): c is { tenant: Tenant; meta: ReturnType<typeof tenantContext>; overlap: number } => c !== null)
    .sort((a, b) => b.overlap - a.overlap);

  if (rentCandidates[0] && rentCandidates[0].overlap >= 1) {
    const { tenant, meta } = rentCandidates[0];
    return {
      tenantId: tenant.id,
      propertyId: meta.propertyId,
      unitId: meta.unitId,
      status: 'suggested',
      confidence: 0.7,
      reason: 'rent-amount-name',
    };
  }

  // 5. Betrag = Kaution + Mieter noch ohne bezahlte Kaution
  const depositCandidates = ctx.contracts
    .filter((c) => !c.depositPaid && c.depositAmount > 0 && amountsMatch(tx.amount, c.depositAmount))
    .map((contract) => {
      const tenant = ctx.tenants.find((t) => t.id === contract.tenantId);
      if (!tenant) return null;
      const tenantTokens = tokenize(tenant.name);
      const overlap = tenantTokens.filter((t) => txTokenSet.has(t)).length;
      return { tenant, contract, overlap };
    })
    .filter((c): c is { tenant: Tenant; contract: RentalContract; overlap: number } => c !== null)
    .sort((a, b) => b.overlap - a.overlap);

  if (depositCandidates[0]) {
    const { tenant, contract, overlap } = depositCandidates[0];
    return {
      tenantId: tenant.id,
      propertyId: contract.propertyId,
      unitId: contract.unitId,
      status: 'suggested',
      confidence: overlap >= 1 ? 0.7 : 0.6,
      reason: 'deposit-amount',
    };
  }

  return { status: 'unmatched', confidence: 0, reason: 'no-match' };
}

/**
 * Bequeme Markierung des Matchers für Display-Zwecke.
 * Vor Aufruf: TX `matchedTenantId` und `matchStatus` werden je nach Ergebnis gesetzt.
 */
export function applyMatch(tx: BankTransaction, result: MatchResult): BankTransaction {
  if (result.status === 'auto') {
    return {
      ...tx,
      matchedTenantId: result.tenantId,
      matchedPropertyId: result.propertyId,
      matchedUnitId: result.unitId,
      matchStatus: 'auto',
      matchConfidence: result.confidence,
      category: tx.category ?? (result.reason === 'deposit-amount' ? undefined : 'miete'),
    };
  }
  // Für 'suggested' speichern wir den Tipp NICHT auf matchedTenantId,
  // damit der Mieteingang-Tab nur bestätigte Treffer zählt.
  return {
    ...tx,
    matchStatus: result.status,
    matchConfidence: result.confidence,
  };
}
