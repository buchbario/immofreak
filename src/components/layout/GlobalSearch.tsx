import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Building2, HardHat, Home, Users, Plug,
  SearchCheck, CornerDownLeft, Calculator,
  LayoutDashboard, Receipt, FileText, CreditCard,
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useContractors } from '../../hooks/useContractors';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useTenants } from '../../hooks/useTenants';
import { useUtilities } from '../../hooks/useUtilities';
import { useDealAnalyses } from '../../hooks/useDealAnalyses';
import { useAppMode } from '../../context/AppModeContext';
import { cn } from '../../lib/utils';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: typeof Building2;
  iconColor: string;
  iconBg: string;
  path: string;
}

interface QuickLink {
  label: string;
  icon: typeof Building2;
  path: string;
  iconColor: string;
  iconBg: string;
}

/* ── highlight matched text ── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-primary font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { mode } = useAppMode();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { projects } = useProjects();
  const { contractors } = useContractors();
  const { properties } = useRentalProperties();
  const { allTenants } = useTenants();
  const { allUtilities } = useUtilities();
  const { analyses } = useDealAnalyses();

  // Animate in
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => setAnimating(true));
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setAnimating(false);
    }
  }, [open]);

  // Quick links based on mode
  const quickLinks = useMemo<QuickLink[]>(() => {
    if (mode === 'fixflip') return [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/', iconColor: 'text-[#4F6BFF]', iconBg: 'bg-[#4F6BFF]/10' },
      { label: 'Projekte', icon: Building2, path: '/projekte', iconColor: 'text-[#4F6BFF]', iconBg: 'bg-[#4F6BFF]/10' },
      { label: 'Handwerker', icon: HardHat, path: '/handwerker', iconColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-500/10' },
      { label: 'Deal Analyzer', icon: SearchCheck, path: '/deal-analyzer', iconColor: 'text-[#4F6BFF]', iconBg: 'bg-[#4F6BFF]/10' },
      { label: 'Kalkulator', icon: Calculator, path: '/kalkulator', iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-500/10' },
    ];
    return [
      { label: 'Objekte', icon: Home, path: '/bh/objekte', iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-500/10' },
      { label: 'Mieter', icon: Users, path: '/bh/mieter', iconColor: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-500/10' },
      { label: 'Transaktionen', icon: Receipt, path: '/bh/transaktionen', iconColor: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-500/10' },
      { label: 'Schreiben', icon: FileText, path: '/bh/schreiben', iconColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-500/10' },
      { label: 'Ausgaben', icon: CreditCard, path: '/bh/ausgaben', iconColor: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-500/10' },
      { label: 'Nebenkosten', icon: Receipt, path: '/bh/nebenkosten', iconColor: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-100 dark:bg-cyan-500/10' },
    ];
  }, [mode]);

  // Build search index
  const allItems = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];

    projects.forEach(p => items.push({
      id: p.id, title: p.name, subtitle: p.address || p.status,
      category: 'Projekte', icon: Building2,
      iconColor: 'text-[#4F6BFF]', iconBg: 'bg-[#4F6BFF]/10',
      path: `/projekte/${p.id}`,
    }));

    contractors.forEach(c => items.push({
      id: c.id, title: c.name, subtitle: [c.trade, c.company].filter(Boolean).join(' · '),
      category: 'Handwerker', icon: HardHat,
      iconColor: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-500/10',
      path: `/handwerker/${c.id}`,
    }));

    properties.forEach(p => items.push({
      id: p.id, title: p.name, subtitle: p.address,
      category: 'Objekte', icon: Home,
      iconColor: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-500/10',
      path: `/bh/objekte/${p.id}`,
    }));

    allTenants.forEach(t => items.push({
      id: t.id, title: t.name, subtitle: t.email || t.phone || '',
      category: 'Mieter', icon: Users,
      iconColor: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-500/10',
      path: `/bh/mieter/${t.id}`,
    }));

    allUtilities.forEach(u => items.push({
      id: u.id, title: u.provider, subtitle: [u.type, u.meterNumber].filter(Boolean).join(' · '),
      category: 'Versorger', icon: Plug,
      iconColor: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-100 dark:bg-cyan-500/10',
      path: '/bh/versorger',
    }));

    analyses.forEach(a => items.push({
      id: a.id, title: a.name, subtitle: a.address || 'Deal Analyse',
      category: 'Analysen', icon: SearchCheck,
      iconColor: 'text-[#4F6BFF]', iconBg: 'bg-[#4F6BFF]/10',
      path: '/deal-analyzer',
    }));

    return items;
  }, [projects, contractors, properties, allTenants, allUtilities, analyses]);

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query, allItems]);

  // Group results by category
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach(r => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [results]);

  const flatResults = results;

  // Navigate to result
  const goTo = useCallback((path: string) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[activeIndex]) {
      e.preventDefault();
      goTo(flatResults[activeIndex].path);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [flatResults, activeIndex, goTo, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] sm:pt-[16vh]">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          animating ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={cn(
        'relative w-full max-w-[560px] mx-4 rounded-2xl overflow-hidden',
        'bg-card/95 backdrop-blur-md border border-white/15 dark:border-white/10',
        'shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.05)]',
        'transition-all duration-200',
        animating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] -translate-y-2'
      )}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-1">
          <div className="relative">
            <Search size={20} className={cn(
              'transition-colors',
              query.trim() ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Suchen..."
            className="flex-1 py-2.5 px-3 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground border border-card-line outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 appearance-none rounded-lg font-medium"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="p-1.5 rounded-lg hover:bg-layer-hover text-muted-foreground cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-2 py-1 rounded-md bg-muted/80 text-[11px] font-medium text-muted-foreground border border-card-divider cursor-pointer hover:bg-muted transition-colors"
            >
              ESC
            </button>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-card-divider to-transparent" />

        {/* Content */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto overscroll-contain">

          {/* ── Empty state: Quick Links ── */}
          {!query.trim() && (
            <div className="p-3">
              <p className="px-2 pb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Schnellzugriff
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {quickLinks.map(link => (
                  <button
                    key={link.path}
                    onClick={() => goTo(link.path)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left cursor-pointer hover:bg-layer-hover transition-colors group"
                  >
                    <div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', link.iconBg)}>
                      <link.icon size={15} className={link.iconColor} />
                    </div>
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{link.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 px-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Search size={11} />
                <span>Tippe um Projekte, Handwerker, Mieter und mehr zu finden</span>
              </div>
            </div>
          )}

          {/* ── No results ── */}
          {query.trim() && results.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center px-6">
              <div className="size-12 rounded-2xl bg-muted/80 flex items-center justify-center mb-3">
                <Search size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Keine Ergebnisse</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kein Treffer für "<span className="font-medium text-foreground">{query}</span>".
                <br />Versuche einen anderen Suchbegriff.
              </p>
            </div>
          )}

          {/* ── Results ── */}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="px-2 pt-1 first:pt-2">
              <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {category}
              </p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  itemIndex++;
                  const idx = itemIndex;
                  const isActive = activeIndex === idx;
                  return (
                    <button
                      key={`${item.category}-${item.id}`}
                      data-index={idx}
                      onClick={() => goTo(item.path)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-100 cursor-pointer',
                        isActive
                          ? 'bg-primary/10 dark:bg-primary/15'
                          : 'hover:bg-layer-hover'
                      )}
                    >
                      <div className={cn(
                        'size-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                        isActive ? 'bg-primary/15 dark:bg-primary/20 scale-105' : item.iconBg
                      )}>
                        <item.icon size={16} className={cn(
                          'transition-colors',
                          isActive ? 'text-primary' : item.iconColor
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate transition-colors',
                          isActive ? 'text-primary' : 'text-foreground'
                        )}>
                          <Highlight text={item.title} query={query} />
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            <Highlight text={item.subtitle} query={query} />
                          </p>
                        )}
                      </div>
                      <div className={cn(
                        'shrink-0 transition-all duration-100',
                        isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
                      )}>
                        <div className="size-6 rounded-lg bg-primary/15 flex items-center justify-center">
                          <CornerDownLeft size={12} className="text-primary" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bottom padding */}
          {results.length > 0 && <div className="h-1" />}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-card-divider to-transparent" />
            <div className="flex items-center justify-between px-5 py-2.5">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {results.length} Ergebnis{results.length !== 1 ? 'se' : ''}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <kbd className="inline-flex items-center justify-center size-5 bg-muted/80 rounded border border-card-divider text-[10px] font-medium">↑</kbd>
                  <kbd className="inline-flex items-center justify-center size-5 bg-muted/80 rounded border border-card-divider text-[10px] font-medium">↓</kbd>
                  <span className="ml-0.5">Navigieren</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <kbd className="inline-flex items-center justify-center h-5 px-1.5 bg-muted/80 rounded border border-card-divider text-[10px] font-medium">↵</kbd>
                  <span className="ml-0.5">Öffnen</span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
