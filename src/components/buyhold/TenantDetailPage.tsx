import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Wallet, CheckCircle2, XCircle } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useTenants } from '../../hooks/useTenants';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenantPayments } from '../../hooks/useTenantPayments';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useContractDocuments } from '../../hooks/useContractDocuments';
import { useTrash } from '../../hooks/useTrash';
import { cascadeTenantToTrash } from '../../lib/cascadeDelete';
import { DocumentList } from '../shared/DocumentList';
import { TenantForm } from './TenantForm';
import { PaymentForm } from './PaymentForm';
import type { TenantPayment } from '../../types';

function statusDotClass(status: TenantPayment['status']) {
  switch (status) {
    case 'eingegangen': return 'dot-green';
    case 'ausstehend': return 'dot-amber';
    case 'überfällig': return 'dot-red';
  }
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allTenants, updateTenant } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { payments, createPayment, deletePayment } = useTenantPayments(id);
  const { allContracts } = useRentalContracts();
  const { moveToTrash } = useTrash();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<TenantPayment | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const tenant = allTenants.find((t) => t.id === id);
  const tenantContracts = allContracts.filter((c) => c.tenantId === id);
  if (!tenant) {
    return (
      <div className="page-container">
        <p className="text-sm text-muted-foreground-2">Mieter nicht gefunden.</p>
        <button onClick={() => navigate('/bh/mieter')} className="btn btn-md btn-secondary mt-4">Zurück</button>
      </div>
    );
  }

  const property = properties.find((p) => p.id === tenant.propertyId);
  const unit = allUnits.find((u) => u.id === tenant.unitId);
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });

  const sortedPayments = [...payments].sort((a, b) => b.date.localeCompare(a.date));
  const totalReceived = payments.filter((p) => p.status === 'eingegangen').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === 'ausstehend' || p.status === 'überfällig').reduce((sum, p) => sum + p.amount, 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
        <button onClick={() => navigate('/bh/mieter')} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{tenant.name}</h1>
          <p className="page-subtitle">{property?.name || '--'} &middot; {unit?.name || 'Keine Einheit'}</p>
        </div>
        <button onClick={() => setShowEdit(true)} className="btn btn-md btn-secondary">
          <Edit2 size={14} /> Bearbeiten
        </button>
        <button onClick={() => setConfirmDelete(true)} className="btn btn-sm btn-ghost text-red-400 hover:text-red-300">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Payment history (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="surface">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">Zahlungsverlauf</h3>
                <button onClick={() => setShowPaymentForm(true)} className="btn btn-sm btn-primary">
                  <Plus size={14} /> Zahlung erfassen
                </button>
              </div>

              {/* Summary */}
              <div className="flex gap-4 mb-4">
                <div className="surface p-5">
                  <p className="stat-label">Eingegangen</p>
                  <p className="stat-value mt-1">{fmt(totalReceived)} EUR</p>
                </div>
                <div className="surface p-5">
                  <p className="stat-label">Offen</p>
                  <p className="stat-value mt-1">{fmt(totalPending)} EUR</p>
                </div>
              </div>

              <div className="mb-4 border-t border-card-divider"></div>

              {/* Payment table */}
              {sortedPayments.length === 0 ? (
                <p className="text-sm py-4 text-muted-foreground-2">Keine Zahlungen vorhanden.</p>
              ) : (
                <div className="surface overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-card-divider">
                        <th className="th">Datum</th>
                        <th className="th">Typ</th>
                        <th className="th text-end">Betrag</th>
                        <th className="th">Status</th>
                        <th className="th">Notiz</th>
                        <th className="th w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPayments.map((p) => (
                        <tr key={p.id} className="transition-colors hover:bg-layer-hover border-b border-card-divider">
                          <td className="td text-foreground">{formatDate(p.date)}</td>
                          <td className="td text-muted-foreground-2">{p.type}</td>
                          <td className="td text-end font-semibold tabular-nums text-foreground">
                            {fmt(p.amount)} EUR
                          </td>
                          <td className="td">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground-2">
                              <span className={`dot ${statusDotClass(p.status)}`} />
                              {p.status}
                            </span>
                          </td>
                          <td className="td max-w-[150px] truncate text-muted-foreground-2">{p.notes || '--'}</td>
                          <td className="td">
                            <button
                              onClick={() => setConfirmDeletePayment(p)}
                              className="cursor-pointer transition-colors text-muted-foreground"
                              title="Löschen"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Contact + Lease cards (1/3 width) */}
        <div className="space-y-4">
          <div className="surface">
            <div className="p-5">
              <h3 className="section-title mb-4">Kontaktdaten</h3>
              <div className="space-y-3">
                <div>
                  <p className="stat-label">E-Mail</p>
                  <p className="text-sm text-foreground">{tenant.email || '--'}</p>
                </div>
                <div className="border-t border-card-divider"></div>
                <div>
                  <p className="stat-label">Telefon</p>
                  <p className="text-sm text-foreground">{tenant.phone || '--'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mietverträge */}
          {tenantContracts.length > 0 ? tenantContracts.map((contract) => (
            <TenantContractCard key={contract.id} contract={contract} navigate={navigate} fmt={fmt} formatDate={formatDate} />
          )) : (
            <div className="surface">
              <div className="p-5">
                <h3 className="section-title mb-4">Mietvertrag</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Einzugsdatum', value: tenant.moveInDate ? formatDate(tenant.moveInDate) : '--' },
                    { label: 'Mietbeginn', value: tenant.leaseStart ? formatDate(tenant.leaseStart) : '--' },
                    { label: 'Mietende', value: tenant.leaseEnd ? formatDate(tenant.leaseEnd) : 'Unbefristet' },
                    { label: 'Kaution', value: `${fmtInt(tenant.deposit)} EUR` },
                    { label: 'Kaltmiete', value: unit ? `${fmtInt(unit.currentRent)} EUR/M` : '--' },
                  ].map((item, i) => (
                    <div key={item.label}>
                      {i > 0 && <div className="mb-3 border-t border-card-divider"></div>}
                      <div className="flex justify-between">
                        <span className="stat-label">{item.label}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tenant.notes && (
            <div className="surface">
              <div className="p-5">
                <h3 className="section-title mb-4">Notizen</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground-2">{tenant.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <TenantForm
          initial={tenant}
          properties={properties}
          units={allUnits}
          onClose={() => setShowEdit(false)}
          onSave={(data) => {
            updateTenant(tenant.id, data);
            setShowEdit(false);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Mieter in den Papierkorb"
          message={`"${tenant.name}" mit allen aktiven Verträgen und Zahlungen in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
          onConfirm={() => {
            cascadeTenantToTrash(tenant.id, moveToTrash);
            navigate('/bh/mieter');
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmDeletePayment && (
        <ConfirmDialog
          title="Zahlung löschen"
          message={`Zahlung vom ${formatDate(confirmDeletePayment.date)} über ${fmt(confirmDeletePayment.amount)} EUR in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
          onConfirm={() => {
            moveToTrash({
              entityType: 'tenantPayment',
              entityId: confirmDeletePayment.id,
              data: confirmDeletePayment,
              label: `${fmt(confirmDeletePayment.amount)} EUR · ${confirmDeletePayment.type}`,
              sublabel: `${tenant.name} · ${formatDate(confirmDeletePayment.date)}`,
            });
            deletePayment(confirmDeletePayment.id);
            setConfirmDeletePayment(null);
          }}
          onCancel={() => setConfirmDeletePayment(null)}
        />
      )}

      {showPaymentForm && (
        <PaymentForm
          tenant={tenant}
          properties={properties}
          units={allUnits}
          onClose={() => setShowPaymentForm(false)}
          onSave={(data) => {
            createPayment(data);
            setShowPaymentForm(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Tenant Contract Card ---------- */
function TenantContractCard({ contract, navigate, fmt, formatDate }: {
  contract: import('../../types').RentalContract;
  navigate: ReturnType<typeof useNavigate>;
  fmt: (n: number) => string;
  formatDate: (d: string) => string;
}) {
  const { documents, addDocument, deleteDocument } = useContractDocuments(contract.id);
  const warmmiete = contract.rentAmount + contract.operatingCosts + contract.heatingCosts;

  const getStatus = () => {
    if (contract.contractType === 'unbefristet') return { label: 'Unbefristet', cls: 'badge-blue' };
    if (!contract.endDate) return { label: 'Befristet', cls: 'badge-amber' };
    const end = new Date(contract.endDate);
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Abgelaufen', cls: 'badge-red' };
    if (daysLeft <= 90) return { label: `${daysLeft}T übrig`, cls: 'badge-amber' };
    return { label: 'Befristet', cls: 'badge-green' };
  };
  const status = getStatus();

  return (
    <div className="bg-card border border-card-line rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-card-divider flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={15} className="text-[#4F6BFF]" />
          <h3 className="text-sm font-semibold text-foreground">Mietvertrag</h3>
          <span className={`badge ${status.cls}`}>{status.label}</span>
        </div>
        <button
          onClick={() => navigate(`/bh/mietvertraege/${contract.id}`)}
          className="text-xs font-medium text-[#4F6BFF] hover:underline cursor-pointer"
        >
          Details →
        </button>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="stat-label">Kaltmiete</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{fmt(contract.rentAmount)} €</p>
          </div>
          <div>
            <p className="stat-label">Warmmiete</p>
            <p className="text-sm font-bold tabular-nums text-[#4F6BFF]">{fmt(warmmiete)} €</p>
          </div>
        </div>
        <div className="border-t border-card-divider pt-3 space-y-2">
          <div className="flex justify-between">
            <span className="stat-label">Vertragsbeginn</span>
            <span className="text-sm font-medium text-foreground">{formatDate(contract.startDate)}</span>
          </div>
          {contract.endDate && (
            <div className="flex justify-between">
              <span className="stat-label">Vertragsende</span>
              <span className="text-sm font-medium text-foreground">{formatDate(contract.endDate)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="stat-label">Kaution ({fmt(contract.depositAmount)} €)</span>
            {contract.depositPaid ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 size={12} /> Bezahlt
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                <XCircle size={12} /> Ausstehend
              </span>
            )}
          </div>
        </div>

        {/* Contract Documents */}
        <div className="border-t border-card-divider pt-3">
          <DocumentList
            documents={documents}
            onAdd={(name, type, size, dataUrl) => addDocument(contract.id, name, type, size, dataUrl)}
            onDelete={deleteDocument}
          />
        </div>
      </div>
    </div>
  );
}

