import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Plus, CheckCircle2, Circle, Wrench, StickyNote, ChevronDown, ChevronUp, FileText, MapPin, Mail, Phone, ArrowLeft, ArrowRight, TrendingUp, Wallet, BarChart3, ListTodo, Calendar as CalendarIcon } from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useContractors } from '../../hooks/useContractors';
import { useProjectContractors } from '../../hooks/useProjectContractors';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { useProjectPhotos } from '../../hooks/useProjectPhotos';
import { useProjectDocuments } from '../../hooks/useProjectDocuments';
import { useTasks } from '../../hooks/useTasks';
import { useTrash } from '../../hooks/useTrash';
import { QuickTaskModal } from '../shared/QuickTaskWidget';
import { cascadeProjectToTrash } from '../../lib/cascadeDelete';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ProjectForm } from './ProjectForm';
import { BudgetTable } from '../budget/BudgetTable';
import { PhotoGallery } from '../shared/PhotoGallery';
import { DocumentList } from '../shared/DocumentList';
import { formatCurrency, formatDate, getBudgetPercentage, calculateProjectedProfit } from '../../lib/utils';
import { PROJECT_STATUSES } from '../../types';
import type { ProjectStatus } from '../../types';

const TABS = [
  { key: 'handwerker', label: 'Handwerker' },
  { key: 'details', label: 'Details' },
  { key: 'budget', label: 'Budget' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'dokumente', label: 'Dokumente' },
  { key: 'notizen', label: 'Notizen' },
] as const;

type TabKey = typeof TABS[number]['key'];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, getProject, updateProject, updateStatus } = useProjects();
  const { contractors } = useContractors();
  const { assignments, assignContractor, unassignContractor } = useProjectContractors(id);
  const { totalActual } = useBudgetItems(id);
  const { photos, addPhoto, deletePhoto } = useProjectPhotos(id);
  const { documents, addDocument, deleteDocument } = useProjectDocuments(id);
  const { allTasks, createTask, toggleStatus } = useTasks();
  const { moveToTrash } = useTrash();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [removeContractorId, setRemoveContractorId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [confirmingDone, setConfirmingDone] = useState<{ id: string; title: string } | null>(null);
  const [confirmingStatus, setConfirmingStatus] = useState<ProjectStatus | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('handwerker');

  // Aufgaben die mit diesem FF-Projekt verknüpft sind, sortiert nach Frist.
  const projectTasks = useMemo(
    () =>
      [...allTasks]
        .filter((t) => t.projectId === id)
        .sort((a, b) => {
          if (a.status === 'erledigt' && b.status !== 'erledigt') return 1;
          if (a.status !== 'erledigt' && b.status === 'erledigt') return -1;
          if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [allTasks, id],
  );
  const openTaskCount = projectTasks.filter((t) => t.status !== 'erledigt').length;

  const project = getProject(id!);
  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground-2">Projekt nicht gefunden.</p>
          <button onClick={() => navigate('/projekte')} className="text-blue-400 hover:text-blue-300 text-sm mt-2 font-semibold cursor-pointer">Zurück</button>
        </div>
      </div>
    );
  }

  const assignedContractorIds = assignments.map((a) => a.contractorId);
  const assignedContractors = contractors.filter((c) => assignedContractorIds.includes(c.id));
  const unassignedContractors = contractors.filter((c) => !assignedContractorIds.includes(c.id));
  const currentNotes = notes !== null ? notes : project.notes;
  const currentStatusIndex = PROJECT_STATUSES.indexOf(project.status);
  const { percentage } = getBudgetPercentage(totalActual, project.renovationBudget);
  // Projizierter Gewinn reagiert live auf Budget-Items: verwendet max(Plan, Ist)
  // als konservative Kosten-Schätzung — Details siehe calculateProjectedProfit.
  const projectedProfit = calculateProjectedProfit(
    project.targetSellPrice,
    project.purchasePrice,
    project.renovationBudget,
    totalActual,
  );

  const handleSaveNotes = () => {
    if (notes !== null) {
      updateProject(project.id, { notes });
      setNotes(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100dvh-3rem)]">
      {/* Left Panel - Timeline */}
      <div
        className="w-full lg:w-[260px] flex flex-col flex-shrink-0 lg:h-full lg:sticky lg:top-0 lg:border-r border-b lg:border-b-0 border-card-line"
        style={{ backgroundColor: 'var(--bg-raised)' }}
      >
        <div className="p-4 sm:p-5 border-b border-card-divider">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="section-title">Timeline</h2>
          </div>
          <p className="text-lg font-semibold tabular-nums text-foreground">Schritt {currentStatusIndex + 1}/{PROJECT_STATUSES.length}</p>
          <p className="text-xs mt-1 text-muted-foreground-2">{project.status}</p>
          <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-card-line">
            <div
              className="h-full rounded-full bg-[#4F6BFF] transition-all"
              style={{ width: `${((currentStatusIndex + 1) / PROJECT_STATUSES.length) * 100}%` }}
            />
          </div>

          {/* Prominenter "Auf nächsten Schritt setzen"-Button — kompakt auf Mobile */}
          {currentStatusIndex < PROJECT_STATUSES.length - 1 && (
            <button
              onClick={() => setConfirmingStatus(PROJECT_STATUSES[currentStatusIndex + 1])}
              className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4F6BFF] hover:bg-[#3D56E0] text-white text-[12px] font-semibold px-3 py-1.5 lg:w-full lg:py-2 lg:text-[12.5px] transition-colors cursor-pointer"
            >
              <span className="lg:hidden">→ {PROJECT_STATUSES[currentStatusIndex + 1]}</span>
              <span className="hidden lg:inline">Nächste Phase: {PROJECT_STATUSES[currentStatusIndex + 1]}</span>
              <ArrowRight size={12} strokeWidth={2.2} className="hidden lg:inline" />
            </button>
          )}
          {currentStatusIndex === PROJECT_STATUSES.length - 1 && (
            <div className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[12px] font-semibold px-3 py-1.5 lg:w-full lg:py-2 lg:text-[12.5px]">
              <CheckCircle2 size={12} /> Abgeschlossen
            </div>
          )}
        </div>

        {/* Steps — horizontal chip scroller on mobile, vertical list on desktop */}
        {/* Mobile: horizontal chips */}
        <div className="lg:hidden px-3 py-3 flex gap-2 overflow-x-auto scroll-x">
          {PROJECT_STATUSES.map((status, index) => {
            const isCompleted = index < currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            return (
              <button
                key={status}
                onClick={() => setConfirmingStatus(status)}
                className={`flex items-center gap-1.5 py-2 px-3 rounded-full whitespace-nowrap text-xs font-semibold transition-all cursor-pointer flex-shrink-0 border ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : isCurrent
                    ? 'bg-[#4F6BFF]/10 border-[#4F6BFF]/40 text-[#4F6BFF]'
                    : 'bg-card border-card-line text-muted-foreground'
                }`}
              >
                {isCompleted && <CheckCircle2 size={13} />}
                {isCurrent && <div className="w-2.5 h-2.5 rounded-full border-2 border-[#4F6BFF]" />}
                {!isCompleted && !isCurrent && <Circle size={13} />}
                {status}
              </button>
            );
          })}
        </div>
        {/* Desktop: vertical list — jeder Step ist ein klickbarer Button mit
            klarem Visual-Cue. Nächster Step bekommt Pfeil-Icon + "→ Klick
            zum Wechseln"-Hint beim Hover. */}
        <div className="hidden lg:block flex-1 overflow-y-auto px-4 py-4">
          <div className="relative">
            {PROJECT_STATUSES.map((status, index) => {
              const isCompleted = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isNext = index === currentStatusIndex + 1;
              const isLast = index === PROJECT_STATUSES.length - 1;
              return (
                <div key={status} className="relative flex items-center">
                  {!isLast && (
                    <div
                      className={`absolute left-[23px] top-[36px] w-px h-[calc(100%-18px)] ${
                        isCompleted ? 'bg-emerald-500/50' : 'bg-card-line'
                      }`}
                    />
                  )}
                  <button
                    onClick={() => setConfirmingStatus(status)}
                    title={isCurrent ? 'Aktueller Status' : `Status auf "${status}" setzen`}
                    className={`flex items-center gap-2.5 w-full py-2.5 px-3 rounded-lg text-left transition-all cursor-pointer group ${
                      isCompleted
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                        : isCurrent
                        ? ''
                        : isNext
                        ? 'hover:bg-[#4F6BFF]/10 ring-1 ring-[#4F6BFF]/20'
                        : 'hover:bg-card-line/40'
                    }`}
                    style={isCurrent ? { backgroundColor: 'var(--accent-dim)' } : {}}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-[18px] h-[18px] rounded-full border-[2.5px] border-blue-500 flex-shrink-0" />
                    ) : (
                      <Circle size={18} className={`flex-shrink-0 transition-colors ${isNext ? 'text-[#4F6BFF]' : 'text-muted-foreground/60'}`} />
                    )}
                    <span className={`text-sm flex-1 ${
                      isCompleted ? 'font-semibold text-emerald-600 dark:text-emerald-400' :
                      isCurrent ? 'font-semibold text-blue-500' :
                      isNext ? 'font-semibold text-[#4F6BFF]' :
                      'text-muted-foreground'
                    }`}>
                      {status}
                    </span>
                    {isCompleted && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Erledigt</span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Aktuell</span>
                    )}
                    {isNext && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4F6BFF] uppercase tracking-wide opacity-90 group-hover:opacity-100">
                        Wechseln <ArrowRight size={11} strokeWidth={2.4} />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10.5px] text-muted-foreground/70 mt-3 px-1 leading-relaxed">
            Klick auf eine Phase wechselt den Status — du wirst vorher gefragt.
          </p>
        </div>

        {/* Bottom nav for other projects — desktop only */}
        <div className="hidden lg:block p-3 border-t border-card-divider">
          {projects.filter(p => p.id !== project.id).slice(0, 2).map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/projekte/${p.id}`)}
              className="w-full text-left px-3 py-2 text-xs rounded-lg cursor-pointer truncate transition-colors text-muted-foreground-2"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:overflow-y-auto min-w-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

          {/* Back link */}
          <button onClick={() => navigate('/projekte')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 cursor-pointer transition-colors">
            <ArrowLeft size={15} />
            Projekte
          </button>

          {/* ── Project Hero Card ── */}
          <div className="bg-card rounded-2xl border border-card-line shadow-sm overflow-hidden mb-5 sm:mb-6">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 sm:mb-5">
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground break-words">{project.name}</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-start gap-1.5">
                    <MapPin size={13} className="mt-0.5 flex-shrink-0" />
                    <span className="break-words">{project.address}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button onClick={() => setShowEdit(true)} className="btn btn-sm btn-secondary">
                    <Pencil size={13} />
                    <span className="hidden sm:inline">Bearbeiten</span>
                  </button>
                  <button onClick={() => navigate(`/projekte/${project.id}/expose`)} className="btn btn-sm btn-primary">
                    <FileText size={13} />
                    Exposé
                  </button>
                  <button
                    onClick={() => setShowDelete(true)}
                    className="size-9 sm:size-8 rounded-lg border border-card-line flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Projekt löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wallet size={13} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Kaufpreis</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(project.purchasePrice)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={13} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Verkaufsziel</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(project.targetSellPrice)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wrench size={13} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Budget</span>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(project.renovationBudget)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 size={13} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Proj. Gewinn</span>
                  </div>
                  <p className={`text-lg font-bold tabular-nums ${
                    projectedProfit >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {formatCurrency(projectedProfit)}
                  </p>
                </div>
              </div>
            </div>

            {/* Budget progress strip */}
            <div className="px-4 sm:px-6 py-3 bg-muted/40 border-t border-card-divider flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Budget</span>
              <div className="flex-1 min-w-[80px] h-2 rounded-full bg-card-divider overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${percentage > 90 ? 'bg-red-500' : 'bg-[#4F6BFF]'}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <span className={`text-xs font-bold tabular-nums ${percentage > 90 ? 'text-red-500' : 'text-foreground'}`}>{percentage}%</span>
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatCurrency(totalActual)} / {formatCurrency(project.renovationBudget)}</span>
            </div>
          </div>

          {/* ── Tabs — horizontal scrollable on mobile, scrollbar visuell ausgeblendet ── */}
          <div className="border-b border-card-line mb-5 sm:mb-6 overflow-x-auto no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="flex gap-0 w-max sm:w-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-2.5 px-3 sm:px-4 text-sm transition-colors cursor-pointer -mb-px border-b-2 whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-[#4F6BFF] text-[#4F6BFF] font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab Content ── */}
          {activeTab === 'handwerker' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {assignedContractors.length} Handwerker zugewiesen
                </p>
                <button
                  onClick={() => setShowAssign(true)}
                  className="btn btn-sm btn-primary"
                >
                  <Plus size={14} />
                  Zuweisen
                </button>
              </div>

              <div className="space-y-3">
                {assignedContractors.map((contractor) => (
                  <div key={contractor.id} className="bg-card rounded-xl border border-card-line p-4 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[#4F6BFF] font-bold text-sm">
                            {contractor.name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground">{contractor.name}</p>
                          {contractor.company && (
                            <p className="text-xs text-muted-foreground mt-0.5">{contractor.company}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                            {contractor.address && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin size={12} className="text-muted-foreground/60 flex-shrink-0" />
                                <span className="truncate max-w-[180px]">{contractor.address}</span>
                              </span>
                            )}
                            {contractor.email && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail size={12} className="text-muted-foreground/60 flex-shrink-0" />
                                {contractor.email}
                              </span>
                            )}
                            {contractor.phone && (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone size={12} className="text-muted-foreground/60 flex-shrink-0" />
                                {contractor.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRemoveContractorId(contractor.id); }}
                        className="btn btn-sm btn-ghost text-red-500 hover:bg-red-500/10 flex-shrink-0"
                        title="Handwerker vom Projekt entfernen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {assignedContractors.length === 0 && (
                <div className="bg-card rounded-xl border border-card-line py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mx-auto mb-3">
                    <Wrench size={20} className="text-[#4F6BFF]" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Noch keine Handwerker</p>
                  <p className="text-xs text-muted-foreground mb-4">Weise Handwerker diesem Projekt zu.</p>
                  <button onClick={() => setShowAssign(true)} className="btn btn-sm btn-primary">
                    <Plus size={14} />
                    Handwerker zuweisen
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div>
              <div className="bg-card rounded-xl border border-card-line overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-card-divider">
                  {[
                    { label: 'Kaufpreis', value: formatCurrency(project.purchasePrice) },
                    { label: 'Verkaufsziel', value: formatCurrency(project.targetSellPrice) },
                    { label: 'Proj. Gewinn', value: formatCurrency(projectedProfit), highlight: true },
                  ].map((item) => (
                    <div key={item.label} className="p-5">
                      <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                      <p className={`text-lg font-bold tabular-nums mt-1.5 ${
                        item.highlight
                          ? (projectedProfit >= 0 ? 'text-emerald-500' : 'text-red-500')
                          : 'text-foreground'
                      }`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-card-divider border-t border-card-divider">
                  {[
                    // Tatsächlicher Verkaufspreis nur anzeigen wenn das Projekt
                    // abgeschlossen ist und der Wert gesetzt wurde. Sonst Platz
                    // für "Sanierungsbudget" + "Erstellt am" — ohne ARV.
                    ...(project.actualSellPrice
                      ? [{ label: 'Tats. Verkaufspreis', value: formatCurrency(project.actualSellPrice), accent: true }]
                      : []),
                    { label: 'Sanierungsbudget', value: formatCurrency(project.renovationBudget) },
                    { label: 'Erstellt am', value: formatDate(project.createdAt) },
                  ].map((item) => (
                    <div key={item.label} className="p-5">
                      <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                      <p className={`text-lg font-bold tabular-nums mt-1.5 ${item.accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowEdit(true)} className="btn btn-sm btn-secondary">
                  <Pencil size={14} />
                  Bearbeiten
                </button>
              </div>
            </div>
          )}

          {activeTab === 'budget' && (
            <BudgetTable projectId={project.id} totalBudget={project.renovationBudget} />
          )}

          {activeTab === 'fotos' && (
            <div className="bg-card rounded-xl border border-card-line p-5">
              <PhotoGallery
                photos={photos}
                onAdd={(name, dataUrl) => addPhoto(project.id, name, dataUrl)}
                onDelete={(photoId) => {
                  const photo = photos.find((p) => p.id === photoId);
                  if (photo) moveToTrash({ entityType: 'projectPhoto', entityId: photo.id, data: photo, label: photo.name, sublabel: project.name });
                  deletePhoto(photoId);
                }}
              />
            </div>
          )}

          {activeTab === 'dokumente' && (
            <div className="bg-card rounded-xl border border-card-line p-5">
              <DocumentList
                documents={documents}
                onAdd={(name, type, size, dataUrl) => addDocument(project.id, name, type, size, dataUrl)}
                onDelete={(docId) => {
                  const doc = documents.find((d) => d.id === docId);
                  if (doc) moveToTrash({ entityType: 'projectDocument', entityId: doc.id, data: doc, label: doc.name, sublabel: project.name });
                  deleteDocument(docId);
                }}
              />
            </div>
          )}

          {activeTab === 'notizen' && (
            <div className="bg-card rounded-xl border border-card-line p-5">
              <textarea
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                rows={12}
                className="input"
                placeholder="Notizen zum Projekt..."
              />
              {notes !== null && notes !== project.notes && (
                <div className="flex justify-end mt-3">
                  <button onClick={handleSaveNotes} className="btn btn-md btn-primary">Notizen speichern</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div
        className="w-full lg:w-[220px] flex-shrink-0 lg:h-full lg:sticky lg:top-0 lg:overflow-y-auto lg:border-l border-t lg:border-t-0 border-card-line"
        style={{ backgroundColor: 'var(--bg-raised)' }}
      >
        {/* Tasks section — projektbezogene Aufgaben */}
        <div>
          <button
            onClick={() => setTasksOpen(!tasksOpen)}
            className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-dim)' }}>
                <ListTodo size={14} className="text-blue-400" />
              </div>
              <span className="section-title">Aufgaben</span>
              {openTaskCount > 0 && (
                <span className="text-[11px] font-bold rounded-full bg-[#4F6BFF]/12 text-[#4F6BFF] px-2 py-0.5 tabular-nums">
                  {openTaskCount} {openTaskCount === 1 ? 'offen' : 'offen'}
                </span>
              )}
            </div>
            {tasksOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
          {tasksOpen && (
            <div className="px-5 pb-4">
              {projectTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground-2">Noch keine Aufgaben verknüpft.</p>
              ) : (
                <div className="space-y-2">
                  {projectTasks.slice(0, 5).map((t) => {
                    const isDone = t.status === 'erledigt';
                    const isOverdue =
                      !isDone && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 rounded-xl border border-card-line bg-card hover:border-[#4F6BFF]/30 transition-colors px-3 py-2.5"
                      >
                        <button
                          onClick={() => {
                            if (isDone) {
                              toggleStatus(t.id, 'offen');
                            } else {
                              setConfirmingDone({ id: t.id, title: t.title });
                            }
                          }}
                          className={`size-[18px] rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            isDone ? 'bg-[#4F6BFF] border-[#4F6BFF]' : 'border-muted-foreground/40 hover:border-[#4F6BFF]'
                          }`}
                          aria-label={isDone ? 'Wieder öffnen' : 'Als erledigt markieren'}
                        >
                          {isDone && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <path d="M5 12l5 5L20 7" />
                            </svg>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] font-medium leading-tight truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {t.title}
                          </p>
                          {t.dueDate && (
                            <p
                              className={`text-[11px] mt-0.5 inline-flex items-center gap-1 ${
                                isOverdue ? 'text-rose-600 font-semibold' : 'text-muted-foreground'
                              }`}
                            >
                              <CalendarIcon size={10} />
                              {new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(new Date(t.dueDate))}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0 text-black ${
                            t.priority === 'hoch'
                              ? 'bg-rose-100'
                              : t.priority === 'mittel'
                                ? 'bg-amber-100'
                                : 'bg-violet-100'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                    );
                  })}
                  {projectTasks.length > 5 && (
                    <button
                      onClick={() => navigate('/aufgaben')}
                      className="w-full text-[11.5px] text-muted-foreground hover:text-foreground py-1 cursor-pointer"
                    >
                      +{projectTasks.length - 5} weitere
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowTaskModal(true)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold mt-3 cursor-pointer"
              >
                <Plus size={12} /> Neue Aufgabe
              </button>
            </div>
          )}
        </div>

        {/* Notes section */}
        <div>
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-dim)' }}>
                <StickyNote size={14} className="text-blue-400" />
              </div>
              <span className="section-title">Notizen</span>
            </div>
            {notesOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
          {notesOpen && (
            <div className="px-5 pb-4">
              {currentNotes ? (
                <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--accent-dim)' }}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground-2">{currentNotes}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground-2">Keine Notizen.</p>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('notizen')}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold mt-3 cursor-pointer"
              >
                {currentNotes ? (
                  <>
                    <Pencil size={12} />
                    Notiz bearbeiten
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    Neue Notiz
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Assign contractor modal */}
      {showAssign && (
        <div className="modal-backdrop" onClick={() => setShowAssign(false)}>
          <div className="modal-overlay" />
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="section-title">Handwerker zuweisen</h3>
              <button className="btn btn-sm btn-ghost rounded-lg" onClick={() => setShowAssign(false)}>&#10005;</button>
            </div>
            <div className="modal-body overflow-y-auto max-h-[60vh] space-y-2">
              {unassignedContractors.length === 0 ? (
                <p className="text-sm font-medium text-center py-4 text-muted-foreground-2">Alle Handwerker sind bereits zugewiesen.</p>
              ) : (
                unassignedContractors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { assignContractor(project.id, c.id); setShowAssign(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left cursor-pointer transition-colors"
                    style={{ backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#4F6BFF] flex items-center justify-center text-white font-semibold text-sm">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground-2">{c.trade} {c.company && `· ${c.company}`}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showEdit && <ProjectForm project={project} onClose={() => setShowEdit(false)} />}

      <ConfirmDialog
        open={!!confirmingStatus}
        onClose={() => setConfirmingStatus(null)}
        onConfirm={() => {
          if (confirmingStatus) updateStatus(project.id, confirmingStatus);
          setConfirmingStatus(null);
        }}
        title="Status ändern?"
        message={
          confirmingStatus && (() => {
            const targetIdx = PROJECT_STATUSES.indexOf(confirmingStatus);
            const goingForward = targetIdx > currentStatusIndex;
            const goingBack = targetIdx < currentStatusIndex;
            return (
              <>
                Projekt-Status von <span className="font-semibold text-foreground">„{project.status}"</span>{' '}
                auf <span className="font-semibold text-foreground">„{confirmingStatus}"</span> setzen?
                {goingForward && (
                  <span className="block mt-2 text-emerald-700 dark:text-emerald-400 text-xs">
                    Damit markierst du „{project.status}" als abgeschlossen.
                  </span>
                )}
                {goingBack && (
                  <span className="block mt-2 text-amber-700 dark:text-amber-400 text-xs">
                    Du gehst eine oder mehrere Phasen zurück.
                  </span>
                )}
              </>
            );
          })()
        }
        confirmLabel="Ja, ändern"
        cancelLabel="Abbrechen"
        variant="primary"
      />

      <ConfirmDialog
        open={!!confirmingDone}
        onClose={() => setConfirmingDone(null)}
        onConfirm={() => {
          if (confirmingDone) toggleStatus(confirmingDone.id, 'erledigt');
          setConfirmingDone(null);
        }}
        title="Aufgabe erledigt?"
        message={
          <>
            <span className="font-semibold text-foreground">„{confirmingDone?.title}"</span> als erledigt
            markieren? Du findest sie weiterhin in der Aufgaben-Liste.
          </>
        }
        confirmLabel="Ja, erledigt"
        cancelLabel="Abbrechen"
        variant="primary"
      />

      {/* Quick-Task-Modal mit vorausgewähltem Projekt */}
      {showTaskModal && (
        <QuickTaskModal
          mode="fixflip"
          projects={[{ id: project.id, name: project.name }]}
          initial={{ projectId: project.id }}
          onClose={() => setShowTaskModal(false)}
          onCreate={(data) => {
            createTask({
              title: data.title,
              description: data.description,
              status: 'offen',
              priority: data.priority,
              category: data.category,
              mode: 'fixflip',
              dueDate: data.dueDate || undefined,
              assignedTo: data.assignedTo || undefined,
              projectId: project.id,
            });
            setShowTaskModal(false);
          }}
        />
      )}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          cascadeProjectToTrash(project.id, moveToTrash);
          navigate('/projekte');
        }}
        title="Projekt in den Papierkorb"
        message={`"${project.name}" mit allen Budget-Positionen, Handwerker-Zuweisungen, Fotos und Dokumenten in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
      />
      {/*
        Bestätigung beim Entfernen einer Handwerker-Zuweisung.
        Der Handwerker selbst wird nicht gelöscht — nur die Verknüpfung
        zu diesem Projekt. Daher kein Papierkorb-Flow.
      */}
      <ConfirmDialog
        open={removeContractorId !== null}
        onClose={() => setRemoveContractorId(null)}
        onConfirm={() => {
          if (removeContractorId) unassignContractor(project.id, removeContractorId);
          setRemoveContractorId(null);
        }}
        title="Handwerker vom Projekt entfernen"
        message={(() => {
          const name = assignedContractors.find((c) => c.id === removeContractorId)?.name ?? 'Diesen Handwerker';
          return `${name} von "${project.name}" entfernen? Der Handwerker bleibt in der Datenbank und kann erneut zugewiesen werden.`;
        })()}
      />
    </div>
  );
}
