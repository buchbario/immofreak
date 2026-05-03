import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Building2, CalendarClock, AlertTriangle, Wallet, Check,
} from 'lucide-react';
import { useAppMode } from '../../context/AppModeContext';
import { useProjects } from '../../hooks/useProjects';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { cn } from '../../lib/utils';

interface Alert {
  id: string;
  icon: typeof Bell;
  iconCls: string;
  bgCls: string;
  title: string;
  desc: string;
  to?: string;
}

function getReadIds(): string[] {
  try { return JSON.parse(localStorage.getItem('immofreak_notif_read') || '[]'); }
  catch { return []; }
}
function setReadIds(ids: string[]) {
  localStorage.setItem('immofreak_notif_read', JSON.stringify(ids));
}

export function NotificationBell({ variant = 'icon' }: { variant?: 'icon' | 'row' } = {}) {
  const { mode } = useAppMode();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIdsState] = useState<string[]>(getReadIds);
  const ref = useRef<HTMLDivElement>(null);

  const { projects } = useProjects();
  const { allBudgetItems } = useBudgetItems();
  const { allUnits } = useRentalUnits();
  const { allTenants } = useTenants();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (mode === 'fixflip') {
      projects.forEach(p => {
        if (p.status === 'Abgeschlossen' || p.renovationBudget <= 0) return;
        const spent = allBudgetItems
          .filter(b => b.projectId === p.id)
          .reduce((s, b) => s + b.actualCost, 0);
        const pct = (spent / p.renovationBudget) * 100;
        if (pct > 90) {
          list.push({
            id: `budget-${p.id}`,
            icon: Wallet,
            iconCls: 'text-red-500',
            bgCls: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
            title: `Budget ${Math.round(pct)}% verbraucht`,
            desc: p.name,
            to: `/projekte/${p.id}`,
          });
        }
      });

      projects.forEach(p => {
        if (p.status === 'Sanierung') {
          const items = allBudgetItems.filter(b => b.projectId === p.id);
          if (items.length === 0) {
            list.push({
              id: `nobudget-${p.id}`,
              icon: AlertTriangle,
              iconCls: 'text-amber-500',
              bgCls: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
              title: 'Keine Budgetposten angelegt',
              desc: `${p.name} ist in Sanierung`,
              to: `/projekte/${p.id}`,
            });
          }
        }
      });
    } else {
      const vacant = allUnits.filter(u => !u.tenantId);
      if (vacant.length > 0) {
        list.push({
          id: 'vacancy',
          icon: Building2,
          iconCls: 'text-red-500',
          bgCls: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
          title: `${vacant.length} ${vacant.length === 1 ? 'Einheit' : 'Einheiten'} ohne Mieter`,
          desc: 'Leerstand reduzieren',
          to: '/bh/objekte',
        });
      }

      allTenants.forEach(t => {
        if (!t.leaseEnd) return;
        const end = new Date(t.leaseEnd);
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
          list.push({
            id: `expired-${t.id}`,
            icon: CalendarClock,
            iconCls: 'text-red-500',
            bgCls: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
            title: 'Vertrag abgelaufen',
            desc: t.name,
            to: `/bh/mieter/${t.id}`,
          });
        } else if (end <= in90) {
          list.push({
            id: `expiring-${t.id}`,
            icon: CalendarClock,
            iconCls: 'text-amber-500',
            bgCls: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
            title: `Vertrag läuft in ${daysLeft}T ab`,
            desc: t.name,
            to: `/bh/mieter/${t.id}`,
          });
        }
      });
    }

    return list;
  }, [mode, projects, allBudgetItems, allUnits, allTenants]);

  const unreadAlerts = alerts.filter(a => !readIds.includes(a.id));
  const unreadCount = unreadAlerts.length;

  const markRead = (id: string) => {
    const next = [...new Set([...readIds, id])];
    setReadIdsState(next);
    setReadIds(next);
  };

  const markAllRead = () => {
    const next = [...new Set([...readIds, ...alerts.map(a => a.id)])];
    setReadIdsState(next);
    setReadIds(next);
  };

  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const updatePos = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
  }, []);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  return (
    <div ref={ref}>
      {variant === 'row' ? (
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          className="relative w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium text-foreground/85 hover:text-foreground hover:bg-white/55 transition-colors cursor-pointer"
        >
          <Bell size={15} strokeWidth={1.9} className="opacity-90 shrink-0" />
          <span className="truncate">Benachrichtigungen</span>
          {unreadCount > 0 && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold text-white bg-rose-500 tabular-nums">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          className="relative flex items-center justify-center size-9 rounded-lg text-foreground/65 hover:text-foreground hover:bg-white/55 transition-colors cursor-pointer"
          aria-label="Benachrichtigungen"
        >
          <Bell size={15} strokeWidth={1.9} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 ring-2 ring-white/80" />
          )}
        </button>
      )}

      {open && (
        <div className="fixed w-80 bg-dropdown border border-dropdown-line rounded-xl shadow-xl z-[80] overflow-hidden" style={{ top: pos.top, right: pos.right }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-dropdown-divider">
            <h3 className="text-sm font-semibold text-foreground">Benachrichtigungen</h3>
            {unreadCount > 0 ? (
              <button onClick={markAllRead} className="text-xs text-[#4F6BFF] hover:text-[#3d57e0] font-medium cursor-pointer transition-colors">
                Alle gelesen
              </button>
            ) : alerts.length > 0 ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                <Check size={12} /> Alles gelesen
              </span>
            ) : null}
          </div>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={20} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Alles in Ordnung!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Keine Hinweise vorhanden.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {alerts.map(a => {
                const isRead = readIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      markRead(a.id);
                      if (a.to) navigate(a.to);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-dropdown-item-hover transition-colors cursor-pointer border-b border-dropdown-divider last:border-0',
                      isRead && 'opacity-50'
                    )}
                  >
                    <div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0 border', a.bgCls)}>
                      <a.icon size={14} className={a.iconCls} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm text-foreground', !isRead ? 'font-semibold' : 'font-medium')}>{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                    </div>
                    {!isRead && (
                      <div className="size-2 rounded-full bg-[#4F6BFF] shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
