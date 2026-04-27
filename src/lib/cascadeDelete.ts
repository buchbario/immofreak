// ============================================================================
// cascadeDelete.ts — zentraler Cascade-to-Trash-Orchestrator
// ============================================================================
// Wenn eine Eltern-Entität gelöscht wird (Objekt, Mietvertrag, Projekt, …),
// werden alle abhängigen Kinder:
//   1. einzeln in den Papierkorb verschoben
//   2. aus ihrem Store entfernt
// Anschließend landet die Eltern-Entität selbst im Papierkorb.
//
// So wird kein Datensatz "hart" gelöscht — der User kann 30 Tage lang
// alles wiederherstellen (siehe `useTrash.ts`).
// ============================================================================

import {
  rentalPropertyStore,
  rentalUnitStore,
  tenantStore,
  rentalContractStore,
  contractDocumentStore,
  tenantPaymentStore,
  meterReadingStore,
  expenseStore,
  taskStore,
  distributionKeyStore,
  propertyPhotoStore,
  propertyDocumentStore,
  utilityStore,
  utilityCostStore,
  bankAccountStore,
  bankTransactionStore,
  projectStore,
  projectContractorStore,
  projectPhotoStore,
  projectDocumentStore,
  dealAnalysisStore,
  contractorStore,
  budgetItemStore,
} from './storage';
import type { TrashEntityType } from '../types';

export interface MoveToTrashParams {
  entityType: TrashEntityType;
  entityId: string;
  data: unknown;
  label: string;
  sublabel?: string;
}

export type MoveToTrashFn = (params: MoveToTrashParams) => unknown;

// ----------------------------------------------------------------------------
// Property (Objekt) — räumt ALLE abhängigen Buy & Hold-Entitäten
// ----------------------------------------------------------------------------
export function cascadePropertyToTrash(propertyId: string, moveToTrash: MoveToTrashFn): number {
  const property = rentalPropertyStore.getById(propertyId);
  if (!property) return 0;
  const sublabel = property.name;
  let count = 0;

  // 1. Mietverträge (+ zugeordnete Dokumente + Zahlungen)
  rentalContractStore.getByField('propertyId', propertyId).forEach((c) => {
    contractDocumentStore.getByField('contractId', c.id).forEach((d) => {
      moveToTrash({ entityType: 'contractDocument', entityId: d.id, data: d, label: d.name, sublabel });
      contractDocumentStore.delete(d.id);
      count++;
    });
    moveToTrash({ entityType: 'rentalContract', entityId: c.id, data: c, label: 'Mietvertrag', sublabel });
    rentalContractStore.delete(c.id);
    count++;
  });

  // 2. Zahlungen (propertyId-basiert — falls Verträge mal ohne Contract existieren)
  tenantPaymentStore.getByField('propertyId', propertyId).forEach((p) => {
    moveToTrash({
      entityType: 'tenantPayment',
      entityId: p.id,
      data: p,
      label: `${p.type} · ${p.amount} €`,
      sublabel,
    });
    tenantPaymentStore.delete(p.id);
    count++;
  });

  // 3. Mieter
  tenantStore.getByField('propertyId', propertyId).forEach((t) => {
    moveToTrash({ entityType: 'tenant', entityId: t.id, data: t, label: t.name, sublabel });
    tenantStore.delete(t.id);
    count++;
  });

  // 4. Einheiten
  rentalUnitStore.getByField('propertyId', propertyId).forEach((u) => {
    moveToTrash({ entityType: 'rentalUnit', entityId: u.id, data: u, label: u.name, sublabel });
    rentalUnitStore.delete(u.id);
    count++;
  });

  // 5. Versorger + Kosten-Historie
  utilityStore.getByField('propertyId', propertyId).forEach((u) => {
    utilityCostStore.getByField('utilityId', u.id).forEach((cost) => {
      moveToTrash({
        entityType: 'utilityCost',
        entityId: cost.id,
        data: cost,
        label: `${u.provider} — ${cost.year}`,
        sublabel,
      });
      utilityCostStore.delete(cost.id);
      count++;
    });
    moveToTrash({ entityType: 'utility', entityId: u.id, data: u, label: u.provider, sublabel });
    utilityStore.delete(u.id);
    count++;
  });

  // 6. Zählerstände
  meterReadingStore.getByField('propertyId', propertyId).forEach((m) => {
    moveToTrash({
      entityType: 'meterReading',
      entityId: m.id,
      data: m,
      label: `Zählerstand ${m.value}`,
      sublabel,
    });
    meterReadingStore.delete(m.id);
    count++;
  });

  // 7. Verteilerschlüssel
  distributionKeyStore.getByField('propertyId', propertyId).forEach((k) => {
    moveToTrash({ entityType: 'distributionKey', entityId: k.id, data: k, label: k.name, sublabel });
    distributionKeyStore.delete(k.id);
    count++;
  });

  // 8. Ausgaben
  expenseStore.getByField('propertyId', propertyId).forEach((e) => {
    moveToTrash({
      entityType: 'expense',
      entityId: e.id,
      data: e,
      label: `${e.category}: ${e.description}`,
      sublabel,
    });
    expenseStore.delete(e.id);
    count++;
  });

  // 9. Tasks / Vorgänge
  taskStore.getByField('propertyId', propertyId).forEach((t) => {
    moveToTrash({ entityType: 'task', entityId: t.id, data: t, label: t.title, sublabel });
    taskStore.delete(t.id);
    count++;
  });

  // 10. Fotos
  propertyPhotoStore.getByField('propertyId', propertyId).forEach((p) => {
    moveToTrash({ entityType: 'propertyPhoto', entityId: p.id, data: p, label: p.name, sublabel });
    propertyPhotoStore.delete(p.id);
    count++;
  });

  // 11. Dokumente
  propertyDocumentStore.getByField('propertyId', propertyId).forEach((d) => {
    moveToTrash({ entityType: 'propertyDocument', entityId: d.id, data: d, label: d.name, sublabel });
    propertyDocumentStore.delete(d.id);
    count++;
  });

  // 12. Die Property selbst
  moveToTrash({ entityType: 'rentalProperty', entityId: propertyId, data: property, label: property.name });
  rentalPropertyStore.delete(propertyId);
  count++;

  return count;
}

// ----------------------------------------------------------------------------
// RentalContract (Mietvertrag) — zugeordnete Vertragsdokumente
// ----------------------------------------------------------------------------
export function cascadeContractToTrash(contractId: string, moveToTrash: MoveToTrashFn): number {
  const contract = rentalContractStore.getById(contractId);
  if (!contract) return 0;
  const tenant = tenantStore.getById(contract.tenantId);
  const sublabel = tenant?.name ?? 'Mietvertrag';
  let count = 0;

  contractDocumentStore.getByField('contractId', contractId).forEach((d) => {
    moveToTrash({ entityType: 'contractDocument', entityId: d.id, data: d, label: d.name, sublabel });
    contractDocumentStore.delete(d.id);
    count++;
  });

  moveToTrash({ entityType: 'rentalContract', entityId: contractId, data: contract, label: 'Mietvertrag', sublabel });
  rentalContractStore.delete(contractId);
  count++;

  return count;
}

// ----------------------------------------------------------------------------
// Tenant (Mieter) — aktive Verträge mit-archivieren + Unit-Rückreferenz lösen
// ----------------------------------------------------------------------------
export function cascadeTenantToTrash(tenantId: string, moveToTrash: MoveToTrashFn): number {
  const tenant = tenantStore.getById(tenantId);
  if (!tenant) return 0;
  let count = 0;

  // 1. Verträge, die auf diesen Mieter zeigen
  rentalContractStore.getByField('tenantId', tenantId).forEach((c) => {
    contractDocumentStore.getByField('contractId', c.id).forEach((d) => {
      moveToTrash({ entityType: 'contractDocument', entityId: d.id, data: d, label: d.name, sublabel: tenant.name });
      contractDocumentStore.delete(d.id);
      count++;
    });
    moveToTrash({ entityType: 'rentalContract', entityId: c.id, data: c, label: 'Mietvertrag', sublabel: tenant.name });
    rentalContractStore.delete(c.id);
    count++;
  });

  // 2. Zahlungen des Mieters
  tenantPaymentStore.getByField('tenantId', tenantId).forEach((p) => {
    moveToTrash({
      entityType: 'tenantPayment',
      entityId: p.id,
      data: p,
      label: `${p.type} · ${p.amount} €`,
      sublabel: tenant.name,
    });
    tenantPaymentStore.delete(p.id);
    count++;
  });

  // 3. Rück-Referenz auf Unit auflösen, damit die Einheit wieder frei ist
  if (tenant.unitId) {
    rentalUnitStore.update(tenant.unitId, { tenantId: undefined });
  }

  // 4. Tenant selbst
  moveToTrash({ entityType: 'tenant', entityId: tenantId, data: tenant, label: tenant.name });
  tenantStore.delete(tenantId);
  count++;

  return count;
}

// ----------------------------------------------------------------------------
// BankAccount — zugeordnete Transaktionen mit-archivieren
// ----------------------------------------------------------------------------
export function cascadeBankAccountToTrash(accountId: string, moveToTrash: MoveToTrashFn): number {
  const account = bankAccountStore.getById(accountId);
  if (!account) return 0;
  let count = 0;

  bankTransactionStore.getByField('bankAccountId', accountId).forEach((t) => {
    moveToTrash({
      entityType: 'bankTransaction',
      entityId: t.id,
      data: t,
      label: `${t.counterparty} · ${t.amount} €`,
      sublabel: account.bankName,
    });
    bankTransactionStore.delete(t.id);
    count++;
  });

  moveToTrash({ entityType: 'bankAccount', entityId: accountId, data: account, label: account.bankName });
  bankAccountStore.delete(accountId);
  count++;

  return count;
}

// ----------------------------------------------------------------------------
// Project — alle Fix&Flip-Kinder
// ----------------------------------------------------------------------------
export function cascadeProjectToTrash(projectId: string, moveToTrash: MoveToTrashFn): number {
  const project = projectStore.getById(projectId);
  if (!project) return 0;
  const sublabel = project.name;
  let count = 0;

  budgetItemStore.getByField('projectId', projectId).forEach((b) => {
    moveToTrash({
      entityType: 'budgetItem',
      entityId: b.id,
      data: b,
      label: `${b.category}: ${b.description}`,
      sublabel,
    });
    budgetItemStore.delete(b.id);
    count++;
  });

  projectContractorStore.getByField('projectId', projectId).forEach((a) => {
    moveToTrash({
      entityType: 'projectContractor',
      entityId: a.id,
      data: a,
      label: 'Handwerker-Zuweisung',
      sublabel,
    });
    projectContractorStore.delete(a.id);
    count++;
  });

  projectPhotoStore.getByField('projectId', projectId).forEach((p) => {
    moveToTrash({ entityType: 'projectPhoto', entityId: p.id, data: p, label: p.name, sublabel });
    projectPhotoStore.delete(p.id);
    count++;
  });

  projectDocumentStore.getByField('projectId', projectId).forEach((d) => {
    moveToTrash({ entityType: 'projectDocument', entityId: d.id, data: d, label: d.name, sublabel });
    projectDocumentStore.delete(d.id);
    count++;
  });

  moveToTrash({ entityType: 'project', entityId: projectId, data: project, label: project.name });
  projectStore.delete(projectId);
  count++;

  return count;
}

// ----------------------------------------------------------------------------
// Contractor — Zuweisungen + Budget-Referenzen auflösen
// ----------------------------------------------------------------------------
export function cascadeContractorToTrash(contractorId: string, moveToTrash: MoveToTrashFn): number {
  const contractor = contractorStore.getById(contractorId);
  if (!contractor) return 0;
  let count = 0;

  projectContractorStore.getByField('contractorId', contractorId).forEach((a) => {
    moveToTrash({
      entityType: 'projectContractor',
      entityId: a.id,
      data: a,
      label: 'Handwerker-Zuweisung',
      sublabel: contractor.name,
    });
    projectContractorStore.delete(a.id);
    count++;
  });

  // BudgetItems: contractorId nullen (nicht in Trash — Items gehören zum Project)
  budgetItemStore.getByField('contractorId', contractorId).forEach((b) => {
    budgetItemStore.update(b.id, { contractorId: undefined });
  });

  moveToTrash({ entityType: 'contractor', entityId: contractorId, data: contractor, label: contractor.name });
  contractorStore.delete(contractorId);
  count++;

  return count;
}

// ----------------------------------------------------------------------------
// Utility — zugeordnete Kosten-Einträge
// ----------------------------------------------------------------------------
export function cascadeUtilityToTrash(utilityId: string, moveToTrash: MoveToTrashFn): number {
  const utility = utilityStore.getById(utilityId);
  if (!utility) return 0;
  let count = 0;

  utilityCostStore.getByField('utilityId', utilityId).forEach((cost) => {
    moveToTrash({
      entityType: 'utilityCost',
      entityId: cost.id,
      data: cost,
      label: `${utility.provider} — ${cost.year}`,
    });
    utilityCostStore.delete(cost.id);
    count++;
  });

  moveToTrash({ entityType: 'utility', entityId: utilityId, data: utility, label: utility.provider });
  utilityStore.delete(utilityId);
  count++;

  return count;
}

// ----------------------------------------------------------------------------
// DealAnalysis — einfach in Trash
// ----------------------------------------------------------------------------
export function dealAnalysisToTrash(analysisId: string, moveToTrash: MoveToTrashFn): number {
  const analysis = dealAnalysisStore.getById(analysisId);
  if (!analysis) return 0;
  moveToTrash({ entityType: 'dealAnalysis', entityId: analysisId, data: analysis, label: analysis.name });
  dealAnalysisStore.delete(analysisId);
  return 1;
}
