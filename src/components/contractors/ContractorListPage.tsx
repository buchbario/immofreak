import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, HardHat, Phone, Mail, Search, Euro, Briefcase } from 'lucide-react';
import { useContractors } from '../../hooks/useContractors';
import { useProjectContractors } from '../../hooks/useProjectContractors';
import { StarRating } from '../ui/StarRating';
import { ContractorForm } from './ContractorForm';
import { TRADES } from '../../types';
import type { Trade } from '../../types';
import { cn } from '../../lib/utils';

const TRADE_COLORS: Record<Trade, string> = {
  Maler:        'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  Elektriker:   'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Klempner:     'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  Tischler:     'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  Fliesenleger: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  Dachdecker:   'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  Maurer:       'bg-stone-100 text-stone-700 dark:bg-stone-500/15 dark:text-stone-400',
  Trockenbauer: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  Bodenleger:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Sanitär:      'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  'Home Staging': 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  Sonstige:     'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ContractorListPage() {
  const navigate = useNavigate();
  const { contractors } = useContractors();
  const { allAssignments } = useProjectContractors();
  const [showForm, setShowForm] = useState(false);
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Project count per contractor
  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allAssignments.forEach(a => {
      counts[a.contractorId] = (counts[a.contractorId] || 0) + 1;
    });
    return counts;
  }, [allAssignments]);

  const filtered = contractors.filter((c) => {
    const matchesTrade = tradeFilter === 'all' || c.trade === tradeFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.trade.toLowerCase().includes(q);
    return matchesTrade && matchesSearch;
  });

  const trades = ['all', ...TRADES] as const;

  return (
    <div className="page-container">
      {contractors.length === 0 ? (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Handwerker</h1>
              <p className="page-subtitle">Baue deine Handwerker-Datenbank auf.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
              <Plus size={15} /> Neuer Handwerker
            </button>
          </div>
          <div className="empty-state">
            <div className="w-12 h-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
              <HardHat size={22} className="text-[#4F6BFF]" />
            </div>
            <p className="text-sm font-semibold mb-1 text-foreground">Noch keine Handwerker</p>
            <p className="text-sm mb-5 text-muted-foreground-2">Erstelle deine Handwerker-Datenbank, um sie Projekten zuzuweisen.</p>
            <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
              <Plus size={15} /> Handwerker anlegen
            </button>
          </div>
        </>
      ) : (
        /* ╭──────────────── Floating page card ────────────────╮ */
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Header inside card */}
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1" />
              <button onClick={() => setShowForm(true)} className="btn btn-sm btn-primary shrink-0">
                <Plus size={14} /> Neuer Handwerker
              </button>
            </div>
            <h1 className="text-[26px] sm:text-[28px] font-bold text-foreground tracking-tight leading-tight mb-1">Handwerker</h1>
            <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
              Deine Kontakt-Datenbank für Gewerke. Filter nach Gewerk-Typ oder suche nach Name, Firma oder Stundensatz.
            </p>
          </div>

          {/* Underline-tabs + search */}
          <div className="px-5 sm:px-7 py-3 border-b border-card-divider flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap min-w-0 -mb-3">
              {trades.map((trade) => {
                const isActive = tradeFilter === trade;
                const count = trade === 'all' ? contractors.length : contractors.filter((c) => c.trade === trade).length;
                if (trade !== 'all' && count === 0) return null;
                return (
                  <button
                    key={trade}
                    onClick={() => setTradeFilter(trade)}
                    className={cn(
                      'group relative inline-flex items-center gap-1.5 pb-2 text-[13px] font-medium transition-colors cursor-pointer',
                      isActive ? 'text-[#4F6BFF]' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {trade === 'all' ? 'Alle' : trade}
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums',
                      isActive ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]' : 'bg-layer-hover text-muted-foreground/80',
                    )}>
                      {count}
                    </span>
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />}
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen..."
                className="h-8 pl-7 pr-3 rounded-md bg-layer-hover text-[12px] text-foreground placeholder:text-muted-foreground/70 border border-transparent hover:border-card-line focus:bg-card focus:border-[#4F6BFF]/40 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all w-[160px] focus:w-[220px]"
              />
            </div>
          </div>

          {/* Contractor rows */}
          <div className="overflow-hidden">
            {filtered.length === 0 && (
              <div className="text-center py-10 px-5">
                <Search size={20} className="mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-[13px] text-muted-foreground">Keine Handwerker gefunden.</p>
              </div>
            )}
            {filtered.map((contractor, idx) => {
              const projCount = projectCounts[contractor.id] || 0;
              return (
                <div
                  key={contractor.id}
                  onClick={() => navigate(`/handwerker/${contractor.id}`)}
                  className={cn(
                    'group flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 transition-colors cursor-pointer hover:bg-layer-hover',
                    idx < filtered.length - 1 && 'border-b border-card-divider'
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div
                      className="size-9 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                    >
                      {getInitials(contractor.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">{contractor.name}</span>
                        <span className={cn('badge', TRADE_COLORS[contractor.trade])}>{contractor.trade}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {contractor.company && (
                          <p className="text-xs truncate text-muted-foreground-2">{contractor.company}</p>
                        )}
                        {contractor.hourlyRate > 0 && (
                          <span className="sm:hidden flex items-center gap-1 text-xs font-medium text-foreground">
                            <Euro size={11} className="text-muted-foreground" />
                            {contractor.hourlyRate} €/h
                          </span>
                        )}
                        {projCount > 0 && (
                          <span className="sm:hidden flex items-center gap-1 text-xs text-muted-foreground-2">
                            <Briefcase size={11} />
                            {projCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/*
                    Feste Spalten-Breiten rechts: jede Zelle wird immer
                    gerendert (auch leer) und behält ihre Breite. Dadurch
                    stehen €/h, Projekte, Telefon, E-Mail und Sterne über
                    alle Zeilen hinweg bündig untereinander — unabhängig
                    davon, ob einzelne Felder gesetzt sind.
                  */}
                  <div className="flex items-center gap-4 sm:gap-5 shrink-0">
                    {/* Hourly rate — ab sm */}
                    <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-foreground w-[72px]">
                      {contractor.hourlyRate > 0 && (
                        <>
                          <Euro size={12} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{contractor.hourlyRate} €/h</span>
                        </>
                      )}
                    </span>

                    {/* Project count — ab sm */}
                    <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground-2 w-[96px]">
                      {projCount > 0 && (
                        <>
                          <Briefcase size={12} className="shrink-0" />
                          <span className="truncate">{projCount} {projCount === 1 ? 'Projekt' : 'Projekte'}</span>
                        </>
                      )}
                    </span>

                    {/* Phone — ab lg */}
                    <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground-2 w-[144px] min-w-0">
                      {contractor.phone && (
                        <>
                          <Phone size={12} className="shrink-0" />
                          <span className="truncate">{contractor.phone}</span>
                        </>
                      )}
                    </span>

                    {/* Email — ab lg */}
                    <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground-2 w-[208px] min-w-0">
                      {contractor.email && (
                        <>
                          <Mail size={12} className="shrink-0" />
                          <span className="truncate">{contractor.email}</span>
                        </>
                      )}
                    </span>

                    <StarRating rating={contractor.rating} size={14} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer counter inside card */}
          <div className="px-5 sm:px-7 py-3 border-t border-card-divider">
            <p className="text-[11.5px] text-muted-foreground tabular-nums">
              {filtered.length} von {contractors.length} {contractors.length === 1 ? 'Handwerker' : 'Handwerker'}
            </p>
          </div>
        </div>
      )}

      {showForm && <ContractorForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
