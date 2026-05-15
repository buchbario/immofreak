/**
 * Navbar — horizontale Top-Navigation als Alternative zur Sidebar.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ [Logo]  [Mode-Switch ▼]  Übersicht  Verwaltung ▼  Werkzeuge ▼ … │
 *   │                          [Search ⌘K]  [Tour] 🔔  [Profile ▼]    │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Top-Level-Items mit nur einem Eintrag (z. B. „Übersicht / Dashboard")
 * werden als direkter Link gerendert. Sektionen mit mehreren Items
 * werden als Dropdown-Menüs aufgeklappt. Pinned Boards (Privat-Modus)
 * erscheinen mit Emoji-Prefix.
 *
 * Mobile (< lg): Hamburger-Drawer mit derselben Liste — siehe `MobileNavDrawer`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, HardHat, Calculator, Settings, Zap,
  Home, Users, Plug, FileText, ChevronDown, LogOut,
  Receipt, Wallet, BarChart3, Gauge, X,
  ArrowLeftRight, CreditCard, SearchCheck, Search, Landmark, Trash2,
  Sparkles, ListTodo, FolderArchive, Menu, Target,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppMode } from '../../context/AppModeContext';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';
import { useTranslation } from '../../context/LocaleContext';
import { usePrivateBoards } from '../../hooks/usePrivateBoards';
import { NotificationBell } from './NotificationBell';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  emoji?: string;
}

interface NavSection {
  /** Translation-key für den Section-Titel (z. B. "nav.section.management") */
  title: string;
  /** Icon, der im Dropdown-Trigger erscheint */
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

// ── Sektionen je Modus ────────────────────────────────────────

const fixFlipSections: NavSection[] = [
  {
    title: 'nav.section.overview',
    icon: LayoutDashboard,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'nav.item.dashboard' },
    ],
  },
  {
    title: 'nav.section.management',
    icon: Building2,
    items: [
      { to: '/leads', icon: Target, label: 'nav.item.leads' },
      { to: '/projekte', icon: Building2, label: 'nav.item.projects' },
      { to: '/handwerker', icon: HardHat, label: 'nav.item.contractors' },
    ],
  },
  {
    title: 'nav.section.tools',
    icon: Calculator,
    items: [
      { to: '/kalkulator', icon: Calculator, label: 'nav.item.calculator' },
      { to: '/deal-analyzer', icon: SearchCheck, label: 'nav.item.deal_analyzer' },
    ],
  },
  {
    title: 'nav.section.tasks_communication',
    icon: ListTodo,
    items: [
      { to: '/aufgaben', icon: ListTodo, label: 'nav.item.processes' },
    ],
  },
  {
    title: 'nav.section.system',
    icon: Trash2,
    items: [
      { to: '/papierkorb', icon: Trash2, label: 'nav.item.trash' },
    ],
  },
];

const buyHoldSections: NavSection[] = [
  {
    title: 'nav.section.overview',
    icon: LayoutDashboard,
    items: [
      { to: '/bh', icon: LayoutDashboard, label: 'nav.item.dashboard' },
    ],
  },
  {
    title: 'nav.section.properties',
    icon: Home,
    items: [
      { to: '/bh/objekte', icon: Home, label: 'nav.item.objects' },
      { to: '/bh/mieter', icon: Users, label: 'nav.item.tenants' },
      { to: '/bh/mietvertraege', icon: FileText, label: 'nav.item.contracts' },
      { to: '/bh/versorger', icon: Plug, label: 'nav.item.utilities' },
      { to: '/bh/zaehler', icon: Gauge, label: 'nav.item.meters' },
    ],
  },
  {
    title: 'nav.section.finance',
    icon: Wallet,
    items: [
      { to: '/bh/banking', icon: Landmark, label: 'nav.item.banking' },
      { to: '/bh/transaktionen', icon: Receipt, label: 'nav.item.transactions' },
      { to: '/bh/ausgaben', icon: CreditCard, label: 'nav.item.expenses' },
      { to: '/bh/finanzen', icon: Wallet, label: 'nav.item.finance' },
    ],
  },
  {
    title: 'nav.section.tasks_communication',
    icon: ListTodo,
    items: [
      { to: '/bh/aufgaben', icon: ListTodo, label: 'nav.item.processes' },
      { to: '/bh/schreiben', icon: FileText, label: 'nav.item.letters' },
      { to: '/bh/nebenkosten', icon: Receipt, label: 'nav.item.utility_billing' },
    ],
  },
  {
    title: 'nav.section.reports_archive',
    icon: BarChart3,
    items: [
      { to: '/bh/berichte', icon: BarChart3, label: 'nav.item.reports' },
      { to: '/bh/dokumente', icon: FolderArchive, label: 'nav.item.archive' },
      { to: '/bh/papierkorb', icon: Trash2, label: 'nav.item.trash' },
    ],
  },
];

const privateSectionsBase: NavSection[] = [
  {
    title: 'nav.section.overview',
    icon: LayoutDashboard,
    items: [
      { to: '/privat', icon: LayoutDashboard, label: 'nav.item.dashboard' },
      { to: '/privat/boards', icon: ListTodo, label: 'nav.item.all_boards' },
    ],
  },
  {
    title: 'nav.section.tasks_communication',
    icon: ListTodo,
    items: [
      { to: '/privat/aufgaben', icon: ListTodo, label: 'nav.item.processes' },
    ],
  },
];

// ── Portal dropdown helper ────────────────────────────────────
//
// Dropdowns innerhalb der Navbar laufen in einen CSS-Quirk: sobald
// `overflow-x: auto` auf einem Vorfahren steht (z. B. unsere `<nav>` mit
// horizontalem Scroll für viele Sektionen), wird `overflow-y` automatisch
// ebenfalls geclippt — und damit verschwinden Dropdowns, die nach unten
// aufklappen, hinter dem Container.
//
// Lösung: Dropdown via Portal an `document.body` rendern und mit
// `position: fixed` an die Trigger-Koordinaten gepinnt halten. Dadurch
// ist der Dropdown unabhängig von Vorfahren-Clipping.
//
// align: 'left' | 'right' steuert, ob die Dropdown an der linken oder
// rechten Kante des Triggers ausgerichtet ist (z. B. Profile-Dropdown rechts).
type DropdownAlign = 'left' | 'right';

function useDropdownCoords(open: boolean, align: DropdownAlign = 'left') {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useEffect(() => {
    if (!open) { setCoords(null); return; }
    const update = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      if (align === 'right') {
        setCoords({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
      } else {
        setCoords({ top: rect.bottom + 4, left: Math.max(8, rect.left) });
      }
    };
    update();
    // Auf Scroll/Resize neu positionieren — `true` capture-Phase damit
    // wir auch verschachtelten Scroll erfassen.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, align]);

  return { triggerRef, coords };
}

// ── Tooltip helper (kept local, simpler than the Sidebar Tip) ───

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-dropdown border border-dropdown-line rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-[60] shadow-lg text-foreground">
        {label}
      </div>
    </div>
  );
}

// ── Section dropdown trigger ────────────────────────────────────

function SectionDropdown({ section }: { section: NavSection }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const Icon = section.icon;
  const { triggerRef, coords } = useDropdownCoords(open, 'left');

  // Hover-Handling: Mouseenter öffnet sofort, Mouseleave schließt mit kurzem
  // Delay — gibt dem User Zeit, vom Trigger ins Dropdown zu wandern ohne dass
  // es zwischendurch zuklappt. Nur aktiv auf Geräten mit Hover-Capability.
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };
  const supportsHover = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  // Close dropdown when route changes (after click)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on outside click — checke beide Refs (Trigger + Portal-Dropdown),
  // weil das Dropdown an `document.body` rendert und nicht mehr im DOM-Tree
  // des Triggers steckt.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, triggerRef]);

  // Cleanup pending close timer on unmount
  useEffect(() => () => cancelClose(), []);

  // Active wenn aktueller Pfad zu einem Item dieser Sektion gehört
  const isActive = section.items.some((item) => {
    if (item.to === '/' || item.to === '/bh' || item.to === '/privat') {
      return location.pathname === item.to;
    }
    return location.pathname.startsWith(item.to);
  });

  // Wenn Sektion nur 1 Item hat → direkter Link (kein Dropdown)
  if (section.items.length === 1) {
    const item = section.items[0];
    return (
      <NavLink
        to={item.to}
        end={item.to === '/' || item.to === '/bh' || item.to === '/privat'}
      >
        {({ isActive: active }) => (
          <button
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap',
              active
                ? 'bg-[#4F6BFF]/10 text-[#4F6BFF]'
                : 'text-foreground/75 hover:text-foreground hover:bg-layer-hover',
            )}
          >
            <Icon size={14} strokeWidth={active ? 2.2 : 1.9} />
            {t(item.label)}
          </button>
        )}
      </NavLink>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        onMouseEnter={() => { if (supportsHover()) { cancelClose(); setOpen(true); } }}
        onMouseLeave={() => { if (supportsHover()) scheduleClose(); }}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap',
          isActive
            ? 'bg-[#4F6BFF]/10 text-[#4F6BFF]'
            : 'text-foreground/75 hover:text-foreground hover:bg-layer-hover',
        )}
        aria-expanded={open}
      >
        <Icon size={14} strokeWidth={isActive ? 2.2 : 1.9} />
        {t(section.title)}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          onMouseEnter={cancelClose}
          onMouseLeave={() => { if (supportsHover()) scheduleClose(); }}
          className="dropdown-anim-in z-[80] bg-dropdown border border-dropdown-line rounded-xl shadow-[0_8px_24px_-4px_rgba(15,23,42,0.18)] p-1 min-w-[220px]"
        >
          {section.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/' || item.to === '/bh' || item.to === '/privat'}
                onClick={() => setOpen(false)}
              >
                {({ isActive: active }) => (
                  <div
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] cursor-pointer',
                      'transition-colors duration-150 ease-out',
                      active
                        ? 'bg-[#4F6BFF]/12 text-[#4F6BFF] font-semibold'
                        : 'text-foreground hover:bg-[#4F6BFF]/8 hover:text-[#4F6BFF]',
                    )}
                  >
                    {item.emoji ? (
                      <span className="size-[16px] flex items-center justify-center text-[15px] leading-none" aria-hidden>{item.emoji}</span>
                    ) : (
                      <ItemIcon size={15} className="flex-shrink-0 opacity-90" strokeWidth={active ? 2.2 : 1.85} />
                    )}
                    <span className="truncate">{t(item.label)}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Mode switch (kompakt für die Navbar) ───────────────────────

function ModeSwitch() {
  const { mode, setMode } = useAppMode();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { triggerRef, coords } = useDropdownCoords(open, 'left');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, triggerRef]);

  const ModeIcon = mode === 'fixflip' ? Zap : mode === 'private' ? Sparkles : Home;
  const modeLabel = t(
    mode === 'fixflip' ? 'mode.fixflip.label' : mode === 'private' ? 'mode.private.label' : 'mode.buyhold.label',
  );
  const modeGradient =
    mode === 'fixflip' ? 'from-amber-400 via-orange-500 to-orange-600' :
    mode === 'private' ? 'from-violet-400 via-fuchsia-500 to-rose-500' :
    'from-emerald-400 via-emerald-500 to-teal-600';

  const switchMode = (m: 'fixflip' | 'buyhold' | 'private') => {
    if (m === mode) { setOpen(false); return; }
    setMode(m); setOpen(false);
    navigate(m === 'fixflip' ? '/' : m === 'private' ? '/privat' : '/bh');
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-label={t('mode.switch.aria', { label: modeLabel })}
        data-tour="mode-switch"
        className={cn(
          'group inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-150',
          'bg-gradient-to-br', modeGradient,
          'shadow-[0_2px_8px_-2px_rgba(15,23,42,0.16)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.22)]',
          'ring-1 ring-white/40',
        )}
      >
        <span className="size-5 rounded-md flex items-center justify-center bg-white/25 ring-1 ring-white/40 backdrop-blur-sm">
          <ModeIcon size={11} className="text-white drop-shadow-sm" strokeWidth={2.4} />
        </span>
        {/* Label wird auf sehr kleinen Screens (<420 px) ausgeblendet — dann
            bleibt nur die Gradient-Pille mit Mode-Icon + Pfeil sichtbar. */}
        <span className="hidden min-[420px]:inline text-[12.5px] font-semibold text-white drop-shadow-sm">{modeLabel}</span>
        <ArrowLeftRight size={10} className="text-white/85" strokeWidth={2.4} />
      </button>

      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="dropdown-anim-in z-[80] bg-dropdown border border-dropdown-line rounded-xl shadow-[0_8px_24px_-4px_rgba(15,23,42,0.18)] p-1 min-w-[240px]"
        >
          {(['buyhold', 'fixflip', 'private'] as const).map((m) => {
            const ItemIcon = m === 'fixflip' ? Zap : m === 'private' ? Sparkles : Home;
            const itemTint =
              m === 'fixflip' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
              m === 'private' ? 'bg-gradient-to-br from-violet-400 to-fuchsia-500' :
              'bg-gradient-to-br from-emerald-400 to-teal-600';
            const itemLabel = t(
              m === 'fixflip' ? 'mode.fixflip.label' : m === 'private' ? 'mode.private.label' : 'mode.buyhold.label',
            );
            const itemDesc = t(
              m === 'fixflip' ? 'mode.fixflip.desc' :
              m === 'private' ? 'mode.private.desc' :
              'mode.buyhold.desc',
            );
            return (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer',
                  'transition-colors duration-150 ease-out',
                  mode === m ? 'bg-[#4F6BFF]/12' : 'hover:bg-[#4F6BFF]/8',
                )}
              >
                <div className={cn('size-8 rounded-lg flex items-center justify-center ring-1 ring-white/40', itemTint)}>
                  <ItemIcon size={14} className="text-white" />
                </div>
                <div className="text-left min-w-0">
                  <p className={cn('text-[13px] font-semibold', mode === m ? 'text-[#4F6BFF]' : 'text-foreground')}>{itemLabel}</p>
                  <p className="text-[11px] text-muted-foreground">{itemDesc}</p>
                </div>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Profile dropdown ──────────────────────────────────────────

function ProfileDropdown() {
  const { userName, userEmail, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { triggerRef, coords } = useDropdownCoords(open, 'right');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, triggerRef]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-label={t('sidebar.profile')}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg hover:bg-layer-hover transition-colors cursor-pointer"
      >
        <div className="size-8 rounded-full bg-gradient-to-br from-[#4F6BFF] to-[#6B5BFF] flex items-center justify-center ring-2 ring-white/80 shadow-[0_2px_6px_rgba(79,107,255,0.20)]">
          <span className="text-[12px] font-bold text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
        </div>
        <span className="hidden xl:inline text-[12.5px] font-semibold text-foreground max-w-[120px] truncate">{userName || 'User'}</span>
        <ChevronDown size={11} className={cn('text-foreground/55 transition-transform', open && 'rotate-180')} />
      </button>

      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, right: coords.right }}
          className="dropdown-anim-in z-[80] bg-dropdown border border-dropdown-line rounded-xl shadow-[0_8px_24px_-4px_rgba(15,23,42,0.18)] p-1 min-w-[220px]"
        >
          <div className="px-3 py-2 border-b border-dropdown-divider">
            <p className="text-[13px] font-semibold text-foreground truncate">{userName || 'User'}</p>
            <p className="text-[11.5px] text-muted-foreground truncate">{userEmail || ''}</p>
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/einstellungen'); }}
            className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-[13px] text-foreground hover:bg-[#4F6BFF]/8 hover:text-[#4F6BFF] transition-colors duration-150 ease-out cursor-pointer"
          >
            <Settings size={14} /> {t('common.settings')}
          </button>
          <button
            onClick={() => { setOpen(false); logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-rose-600 hover:bg-rose-50 transition-colors duration-150 ease-out cursor-pointer"
          >
            <LogOut size={14} /> {t('sidebar.logout')}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Mobile Drawer ─────────────────────────────────────────────

function MobileNavDrawer({ open, onClose, sections, onSearchClick }: {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
  onSearchClick: () => void;
}) {
  const { t } = useTranslation();
  const { startTour } = useTour();
  const { mode, setMode } = useAppMode();
  const navigate = useNavigate();

  const switchMode = (m: 'fixflip' | 'buyhold' | 'private') => {
    if (m !== mode) {
      setMode(m);
      navigate(m === 'fixflip' ? '/' : m === 'private' ? '/privat' : '/bh');
    }
    onClose();
  };

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      <aside className="fixed inset-y-0 left-0 w-[300px] bg-card border-r border-card-line z-50 lg:hidden flex flex-col">
        <div className="flex items-center justify-between h-14 px-3 border-b border-card-divider flex-shrink-0">
          <img src="/logo.png" alt="ImmoFreak" className="h-7 object-contain" />
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-layer-hover transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode-Switch oben im Drawer — drei deutliche Karten, aktiver Modus
            mit Gradient hervorgehoben. */}
        <div className="px-3 pt-3 pb-2 border-b border-card-divider flex-shrink-0">
          <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">
            Modus
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(['buyhold', 'fixflip', 'private'] as const).map((m) => {
              const ItemIcon = m === 'fixflip' ? Zap : m === 'private' ? Sparkles : Home;
              const gradient =
                m === 'fixflip' ? 'from-amber-400 via-orange-500 to-orange-600' :
                m === 'private' ? 'from-violet-400 via-fuchsia-500 to-rose-500' :
                'from-emerald-400 via-emerald-500 to-teal-600';
              const labelKey =
                m === 'fixflip' ? 'mode.fixflip.label' :
                m === 'private' ? 'mode.private.label' :
                'mode.buyhold.label';
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-1.5 py-2 rounded-lg cursor-pointer transition-all duration-150',
                    active
                      ? cn('bg-gradient-to-br', gradient, 'ring-1 ring-white/40 shadow-[0_3px_10px_-2px_rgba(15,23,42,0.18)]')
                      : 'bg-card-line/30 hover:bg-card-line/50',
                  )}
                  aria-pressed={active}
                >
                  <span className={cn(
                    'size-7 rounded-md flex items-center justify-center',
                    active ? 'bg-white/25 ring-1 ring-white/40' : cn('bg-gradient-to-br', gradient),
                  )}>
                    <ItemIcon size={14} className="text-white drop-shadow-sm" strokeWidth={2.4} />
                  </span>
                  <span className={cn(
                    'text-[10.5px] font-semibold leading-tight truncate max-w-full',
                    active ? 'text-white drop-shadow-sm' : 'text-foreground/80',
                  )}>
                    {t(labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-3">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1.5">
                {t(section.title)}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/' || item.to === '/bh' || item.to === '/privat'}
                    onClick={onClose}
                  >
                    {({ isActive }) => (
                      <div className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-colors',
                        isActive
                          ? 'bg-[#4F6BFF]/10 text-[#4F6BFF] font-semibold'
                          : 'text-foreground hover:bg-layer-hover',
                      )}>
                        {item.emoji ? (
                          <span className="size-[16px] flex items-center justify-center text-[15px] leading-none" aria-hidden>{item.emoji}</span>
                        ) : (
                          <item.icon size={15} className="flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.9} />
                        )}
                        <span className="truncate">{t(item.label)}</span>
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-card-divider p-3 space-y-1 flex-shrink-0">
          <button
            onClick={() => { onClose(); onSearchClick(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-foreground/85 hover:bg-layer-hover transition-colors cursor-pointer"
          >
            <Search size={15} /> {t('common.search')}
          </button>
          <button
            onClick={() => { onClose(); setTimeout(() => startTour(), 220); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#4F6BFF] hover:bg-[#4F6BFF]/8 transition-colors cursor-pointer"
          >
            <Sparkles size={15} /> {t('sidebar.tour')}
          </button>
          <button
            onClick={() => { onClose(); navigate('/einstellungen'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-foreground/85 hover:bg-layer-hover transition-colors cursor-pointer"
          >
            <Settings size={15} /> {t('common.settings')}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Main Navbar ───────────────────────────────────────────────

export function Navbar({ onSearchClick }: { onSearchClick?: () => void }) {
  const { mode, setMode } = useAppMode();
  const { startTour } = useTour();
  const { pinnedBoards } = usePrivateBoards();
  const { t } = useTranslation();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync mode from URL (gleich wie in der Sidebar)
  useEffect(() => {
    const path = location.pathname;
    const isShared = path === '/' || path.startsWith('/einstellungen');
    if (isShared) return;
    const isBH = path.startsWith('/bh');
    const isPrivate = path.startsWith('/privat');
    const target: typeof mode = isPrivate ? 'private' : isBH ? 'buyhold' : 'fixflip';
    if (mode !== target) setMode(target);
  }, [location.pathname]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Privat-Sections dynamisch zusammensetzen (mit Pinned Boards)
  const privateSections: NavSection[] = mode === 'private'
    ? [
        ...privateSectionsBase,
        ...(pinnedBoards.length > 0 ? [{
          title: 'nav.section.pinned',
          icon: ListTodo,
          items: pinnedBoards.map((b) => ({
            to: `/privat/boards/${b.id}`,
            icon: ListTodo,
            label: b.name,
            emoji: b.icon,
          })),
        }] : []),
      ]
    : privateSectionsBase;

  const sections =
    mode === 'fixflip' ? fixFlipSections :
    mode === 'private' ? privateSections :
    buyHoldSections;

  const handleStartTour = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMobileOpen(false);
    }
    setTimeout(() => startTour(), 220);
  };

  return (
    <>
      <header className="bg-card border-b border-card-line h-16 flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 z-30 relative">
        {/* Mobile: hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Menü"
          className="lg:hidden size-9 -ml-1.5 rounded-lg flex items-center justify-center text-foreground hover:bg-layer-hover active:bg-layer-active cursor-pointer"
        >
          <Menu size={20} />
        </button>

        {/* Logo */}
        <NavLink
          to={mode === 'fixflip' ? '/' : mode === 'private' ? '/privat' : '/bh'}
          className="flex-shrink-0 flex items-center"
        >
          <img src="/logo.png" alt="ImmoFreak" className="h-7 sm:h-8 object-contain" />
        </NavLink>

        {/* Mode-Switch — auch auf Mobile sichtbar; bei < 420 px wird das Label
            ausgeblendet damit nur das Gradient-Icon-Pille bleibt. */}
        <div className="flex-shrink-0 ml-1 sm:ml-2">
          <ModeSwitch />
        </div>

        {/* Section-Navigation (Desktop only — auf Mobile zeigt Hamburger das Menü) */}
        <nav className="hidden lg:flex items-center gap-0.5 ml-3 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {sections.map((section) => (
            <SectionDropdown key={section.title} section={section} />
          ))}
        </nav>

        {/* Spacer auf kleineren Screens */}
        <div className="lg:hidden flex-1" />

        {/* Right side actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onSearchClick && (
            <Tip label={`${t('common.search')} (⌘K)`}>
              <button
                onClick={onSearchClick}
                aria-label={t('common.search')}
                className="size-9 rounded-lg flex items-center justify-center text-foreground/65 hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer"
              >
                <Search size={17} strokeWidth={1.9} />
              </button>
            </Tip>
          )}
          <Tip label={t('sidebar.tour')}>
            <button
              onClick={handleStartTour}
              aria-label={t('sidebar.tour')}
              className="hidden sm:flex size-9 rounded-lg items-center justify-center text-[#4F6BFF] hover:bg-[#4F6BFF]/10 transition-colors cursor-pointer"
            >
              <Sparkles size={17} strokeWidth={2} />
            </button>
          </Tip>
          <NotificationBell />
          <ProfileDropdown />
        </div>
      </header>

      <MobileNavDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sections={sections}
        onSearchClick={onSearchClick ?? (() => {})}
      />
    </>
  );
}
