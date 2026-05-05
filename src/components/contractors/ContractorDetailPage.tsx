import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Phone, Mail, MapPin, Euro, Building2 } from 'lucide-react';
import { useContractors } from '../../hooks/useContractors';
import { useProjects } from '../../hooks/useProjects';
import { useProjectContractors } from '../../hooks/useProjectContractors';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { useTrash } from '../../hooks/useTrash';
import { cascadeContractorToTrash } from '../../lib/cascadeDelete';
import { StarRating } from '../ui/StarRating';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ContractorForm } from './ContractorForm';
import { formatCurrency, getStatusColor } from '../../lib/utils';

export function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getContractor } = useContractors();
  const { projects } = useProjects();
  const { allAssignments } = useProjectContractors();
  const { allBudgetItems } = useBudgetItems();
  const { moveToTrash } = useTrash();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const contractor = getContractor(id!);
  if (!contractor) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground-2">Handwerker nicht gefunden.</p>
          <button onClick={() => navigate('/handwerker')} className="text-sm mt-2 font-semibold cursor-pointer text-primary">Zurück</button>
        </div>
      </div>
    );
  }

  const contractorAssignments = allAssignments.filter((a) => a.contractorId === id);
  const assignedProjects = projects.filter((p) => contractorAssignments.some((a) => a.projectId === p.id));
  const contractorBudgetItems = allBudgetItems.filter((i) => i.contractorId === id);
  const totalEarnings = contractorBudgetItems.reduce((sum, i) => sum + i.actualCost, 0);

  return (
    <div className="page-container">
      {/* Flat header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 sm:mb-6 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/handwerker')}
            className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer shrink-0"
            aria-label="Zurück"
          >
            <ArrowLeft size={18} />
          </button>
          <div
            className="size-12 rounded-full flex items-center justify-center shrink-0 ring-1 ring-white/40"
            style={{ background: 'linear-gradient(135deg, #4F6BFF, #3b4eea)' }}
          >
            <span className="text-white font-bold text-[15px]">{contractor.name.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] sm:text-[28px] font-bold text-foreground tracking-tight leading-[1.15] truncate">
              {contractor.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="badge badge-blue">{contractor.trade}</span>
              {contractor.company && (
                <span className="text-[13px] text-muted-foreground truncate">{contractor.company}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 mt-1">
          <button onClick={() => setShowEdit(true)} className="btn btn-sm btn-secondary">
            <Pencil size={13} /> Bearbeiten
          </button>
          <button onClick={() => setShowDelete(true)} className="btn btn-sm btn-ghost text-rose-600 dark:text-rose-400">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact */}
          <div className="surface">
            <div className="p-5">
              <h3 className="section-title mb-4">Kontaktdaten</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contractor.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 flex items-center justify-center">
                      <Phone size={15} className="text-[#4F6BFF]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Telefon</p>
                      <p className="text-sm text-foreground">{contractor.phone}</p>
                    </div>
                  </div>
                )}
                {contractor.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 flex items-center justify-center">
                      <Mail size={15} className="text-[#4F6BFF]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">E-Mail</p>
                      <p className="text-sm text-foreground">{contractor.email}</p>
                    </div>
                  </div>
                )}
                {contractor.address && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 flex items-center justify-center">
                      <MapPin size={15} className="text-[#4F6BFF]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Adresse</p>
                      <p className="text-sm text-foreground">{contractor.address}</p>
                    </div>
                  </div>
                )}
                {contractor.hourlyRate > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 flex items-center justify-center">
                      <Euro size={15} className="text-[#4F6BFF]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Stundensatz</p>
                      <p className="text-sm text-foreground">{contractor.hourlyRate} €/h</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assigned projects */}
          <div className="surface">
            <div className="p-5">
              <h3 className="section-title mb-4">Zugewiesene Projekte ({assignedProjects.length})</h3>
              {assignedProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground-2">Noch keinem Projekt zugewiesen.</p>
              ) : (
                <div className="space-y-2">
                  {assignedProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => navigate(`/projekte/${project.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer transition-colors group"
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--layer-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#4F6BFF]/10 flex items-center justify-center">
                        <Building2 size={14} className="text-[#4F6BFF]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground-2">{project.address}</p>
                      </div>
                      <span className={`badge ${getStatusColor(project.status)}`}>{project.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {contractor.notes && (
            <div className="surface">
              <div className="p-5">
                <h3 className="section-title mb-2">Notizen</h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground-2">{contractor.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Stats */}
        <div className="space-y-4">
          <div className="surface">
            <div className="p-5">
              <p className="stat-label mb-3">Bewertung</p>
              <StarRating rating={contractor.rating} size={22} />
            </div>
          </div>
          <div className="surface">
            <div className="p-5">
              <p className="stat-label">Aufträge</p>
              <p className="stat-value mt-2">{contractorBudgetItems.length}</p>
            </div>
          </div>
          <div className="surface">
            <div className="p-5">
              <p className="stat-label">Gesamtumsatz</p>
              <p className="stat-value mt-2">{formatCurrency(totalEarnings)}</p>
            </div>
          </div>
        </div>
      </div>

      {showEdit && <ContractorForm contractor={contractor} onClose={() => setShowEdit(false)} />}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          cascadeContractorToTrash(contractor.id, moveToTrash);
          navigate('/handwerker');
        }}
        title="Handwerker in den Papierkorb"
        message={`"${contractor.name}" in den Papierkorb verschieben? Aktive Projekt-Zuweisungen werden aufgelöst, Budget-Positionen behalten die Beträge. Innerhalb von 30 Tagen wiederherstellbar.`}
      />
    </div>
  );
}
