import { useEffect, useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, HardHat, Calculator, Settings, Zap,
  Home, Users, Plug, FileText, ChevronDown, LogOut,
  PanelLeftOpen, PanelLeftClose, Receipt, Wallet, BarChart3, Gauge, X,
  ArrowLeftRight,
  CreditCard, SearchCheck, Search, Landmark, Trash2,
  Sparkles, ListTodo, FolderArchive,
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
  /** Optional emoji shown instead of the Lucide icon (used by pinned private boards) */
  emoji?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/* Workflow-oriented categorization. Section-Titel und Item-Labels sind hier
   Translation-Keys (siehe `i18n/translations.ts`) — die Sidebar resolved sie
   beim Render via t(). So ist die Navigation komplett mehrsprachig. */

const fixFlipSections: NavSection[] = [
  {
    title: 'nav.section.overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'nav.item.dashboard' },
    ],
  },
  {
    title: 'nav.section.management',
    items: [
      { to: '/projekte', icon: Building2, label: 'nav.item.projects' },
      { to: '/handwerker', icon: HardHat, label: 'nav.item.contractors' },
    ],
  },
  {
    title: 'nav.section.tools',
    items: [
      { to: '/kalkulator', icon: Calculator, label: 'nav.item.calculator' },
      { to: '/deal-analyzer', icon: SearchCheck, label: 'nav.item.deal_analyzer' },
    ],
  },
  {
    title: 'nav.section.tasks_communication',
    items: [
      { to: '/aufgaben', icon: ListTodo, label: 'nav.item.processes' },
    ],
  },
  {
    title: 'nav.section.system',
    items: [
      { to: '/papierkorb', icon: Trash2, label: 'nav.item.trash' },
    ],
  },
];

const privateSectionsBase: NavSection[] = [
  {
    title: 'nav.section.overview',
    items: [
      { to: '/privat', icon: LayoutDashboard, label: 'nav.item.dashboard' },
      { to: '/privat/boards', icon: ListTodo, label: 'nav.item.all_boards' },
    ],
  },
  {
    title: 'nav.section.tasks_communication',
    items: [
      { to: '/privat/aufgaben', icon: ListTodo, label: 'nav.item.processes' },
    ],
  },
];

const buyHoldSections: NavSection[] = [
  {
    title: 'nav.section.overview',
    items: [
      { to: '/bh', icon: LayoutDashboard, label: 'nav.item.dashboard' },
    ],
  },
  {
    title: 'nav.section.properties',
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
    items: [
      { to: '/bh/banking', icon: Landmark, label: 'nav.item.banking' },
      { to: '/bh/transaktionen', icon: Receipt, label: 'nav.item.transactions' },
      { to: '/bh/ausgaben', icon: CreditCard, label: 'nav.item.expenses' },
      { to: '/bh/finanzen', icon: Wallet, label: 'nav.item.finance' },
    ],
  },
  {
    title: 'nav.section.tasks_communication',
    items: [
      { to: '/bh/aufgaben', icon: ListTodo, label: 'nav.item.processes' },
      { to: '/bh/schreiben', icon: FileText, label: 'nav.item.letters' },
      { to: '/bh/nebenkosten', icon: Receipt, label: 'nav.item.utility_billing' },
    ],
  },
  {
    title: 'nav.section.reports_archive',
    items: [
      { to: '/bh/berichte', icon: BarChart3, label: 'nav.item.reports' },
      { to: '/bh/dokumente', icon: FolderArchive, label: 'nav.item.archive' },
      { to: '/bh/papierkorb', icon: Trash2, label: 'nav.item.trash' },
    ],
  },
];

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-dropdown border border-dropdown-line rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-[60] shadow-lg text-foreground">
        {label}
      </div>
    </div>
  );
}

export function Sidebar({ onSearchClick }: { onSearchClick?: () => void }) {
  const { mode, setMode, sidebarOpen, setSidebarOpen, setSidebarOpenTransient } = useAppMode();
  const { userName, userEmail, logout } = useAuth();
  const { startTour } = useTour();
  const { pinnedBoards } = usePrivateBoards();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = location.pathname;
    // Shared routes — do not affect the active mode
    const isShared = path === '/' || path.startsWith('/einstellungen');
    if (isShared) return;
    const isBH = path.startsWith('/bh');
    const isPrivate = path.startsWith('/privat');
    const target: typeof mode = isPrivate ? 'private' : isBH ? 'buyhold' : 'fixflip';
    if (mode !== target) setMode(target);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    // Mobile: Drawer nach Navigation schließen — aber transient, damit die
    // vom User gewählte Desktop-Präferenz in localStorage erhalten bleibt.
    if (window.matchMedia('(max-width: 1023px)').matches) setSidebarOpenTransient(false);
  }, [location.pathname]);

  // Privat-Sections dynamisch zusammensetzen: Pinned Boards bekommen eine eigene
  // Sektion „Angepinnt", damit man sie ohne Umweg über die Board-Übersicht erreicht.
  const privateSections: NavSection[] = mode === 'private'
    ? [
        ...privateSectionsBase,
        ...(pinnedBoards.length > 0 ? [{
          title: 'nav.section.pinned',
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
  const allItems = sections.flatMap(s => s.items);
  const ModeIcon = mode === 'fixflip' ? Zap : mode === 'private' ? Sparkles : Home;
  const modeLabel = t(
    mode === 'fixflip' ? 'mode.fixflip.label' : mode === 'private' ? 'mode.private.label' : 'mode.buyhold.label',
  );
  const modeGradient =
    mode === 'fixflip' ? 'from-amber-400 via-orange-500 to-orange-600' :
    mode === 'private' ? 'from-violet-400 via-fuchsia-500 to-rose-500' :
    'from-emerald-400 via-emerald-500 to-teal-600';
  const open = sidebarOpen;

  const nextModeLabel = t(
    mode === 'fixflip' ? 'mode.buyhold.label' :
    mode === 'buyhold' ? 'mode.private.label' :
    'mode.fixflip.label',
  );

  const switchMode = (m: 'fixflip' | 'buyhold' | 'private') => {
    if (m === mode) { setModeOpen(false); return; }
    setMode(m); setModeOpen(false);
    navigate(m === 'fixflip' ? '/' : m === 'private' ? '/privat' : '/bh');
  };

  const handleStartTour = () => {
    // On mobile the drawer would cover the first tour spotlight — close it transient,
    // damit die Desktop-Präferenz beim nächsten Start nicht überschrieben wird.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setSidebarOpenTransient(false);
    }
    // Small delay so the sidebar close animation finishes first
    setTimeout(() => startTour(), 220);
  };

  return (
    <aside
      className={cn(
        'flex flex-col transition-[width,transform] duration-200 z-40 flex-shrink-0',
        // Floating panel: rounded card with subtle inner gradient + soft shadow
        'sidebar-floating border border-card-line',
        // Mobile: fixed drawer (full height); Desktop: sticky inline panel inside the padded shell
        'fixed inset-y-2 left-2 lg:static lg:inset-auto lg:h-full',
        // Mobile: slide-in drawer at fixed width 270px (off-screen when closed)
        open
          ? 'w-[270px] translate-x-0 lg:w-[238px] overflow-hidden'
          : '-translate-x-[calc(100%+0.5rem)] w-[270px] lg:translate-x-0 lg:w-[68px] overflow-hidden lg:overflow-visible'
      )}
    >
      {/* ── Logo ── */}
      <div className={cn(
        'flex items-center flex-shrink-0',
        open ? 'justify-between px-4 pt-4 pb-3.5' : 'justify-center px-2 py-3'
      )}>
        <div
          className={cn('flex items-center', !open && 'cursor-pointer')}
          onClick={() => { if (!open) setSidebarOpen(true); }}
        >
          {open ? (
            <img src="/logo.png" alt="ImmoFreak" className="h-9 object-contain" />
          ) : (
            <img src="/logo-icon.png" alt="ImmoFreak" className="size-9 object-contain flex-shrink-0" />
          )}
        </div>
        {open && (
          <>
            <button
              onClick={() => setSidebarOpenTransient(false)}
              aria-label={t('common.close')}
              className="lg:hidden size-7 rounded-md flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-white/40 cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
            <Tip label={t('sidebar.collapse')}>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label={t('sidebar.collapse')}
                className="hidden lg:flex size-7 rounded-md items-center justify-center text-foreground/60 hover:text-foreground hover:bg-white/40 cursor-pointer transition-colors"
              >
                <PanelLeftClose size={15} strokeWidth={2} />
              </button>
            </Tip>
          </>
        )}
      </div>

      {/* ── Search ── */}
      <div className={cn('flex-shrink-0 mb-3', open ? 'px-3' : 'px-2.5')}>
        {open ? (
          <button
            onClick={onSearchClick}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] text-foreground/60 hover:text-foreground/85 bg-white/55 hover:bg-white/75 transition-colors cursor-pointer"
          >
            <Search size={13} className="shrink-0" />
            <span className="flex-1 text-left">{t('common.search_placeholder')}</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/65 rounded text-[10px] font-medium text-foreground/55">
              ⌘K
            </kbd>
          </button>
        ) : (
          <Tip label={`${t('common.search')} (⌘K)`}>
            <button
              onClick={onSearchClick}
              aria-label={t('common.search')}
              className="w-full flex items-center justify-center py-2 rounded-md text-foreground/60 hover:bg-white/40 hover:text-foreground transition-colors cursor-pointer"
            >
              <Search size={18} strokeWidth={2} />
            </button>
          </Tip>
        )}
      </div>

      {/* ── Navigation — workflow-categorized sections, all items always visible ── */}
      <nav className={cn('flex-1 pb-2', open ? 'px-3 overflow-y-auto overflow-x-hidden' : 'px-2.5 overflow-visible')}>
        {open ? (
          <div className="flex flex-col gap-3">
            {sections.map((section) => (
              <div key={section.title}>
                <div className="sidebar-section-label py-1 mb-0.5">{t(section.title)}</div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map(item => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to === '/bh'}>
                      {({ isActive }) => (
                        <div className={cn('sidebar-nav-item', isActive && 'is-active')}>
                          {item.emoji ? (
                            <span className="size-[17px] flex-shrink-0 inline-flex items-center justify-center text-base leading-none" aria-hidden>{item.emoji}</span>
                          ) : (
                            <item.icon
                              size={17}
                              className="flex-shrink-0 opacity-90"
                              strokeWidth={isActive ? 2.2 : 1.85}
                            />
                          )}
                          <span className="truncate">{t(item.label)}</span>
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {allItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to === '/bh'}>
                {({ isActive }) => (
                  <Tip label={t(item.label)}>
                    <div
                      className={cn(
                        'flex items-center justify-center py-2 rounded-md transition-colors duration-100',
                        isActive
                          ? 'bg-[#f0f4ff] text-[#4F6BFF] shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                          : 'text-foreground/65 hover:bg-layer-hover hover:text-foreground'
                      )}
                    >
                      {item.emoji ? (
                        <span className="text-[17px] leading-none" aria-hidden>{item.emoji}</span>
                      ) : (
                        <item.icon size={18} className="flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.9} />
                      )}
                    </div>
                  </Tip>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* ── Bottom ── */}
      <div className={cn('flex-shrink-0 pb-3 pt-3', open ? 'px-3' : 'px-2.5')}>
        {/* Notifications + Tour + Settings — full-row nav items when expanded, icon-stack when collapsed */}
        {open ? (
          <div className="flex flex-col gap-0.5 mb-2">
            <NotificationBell variant="row" />
            <button
              onClick={handleStartTour}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium text-foreground/85 hover:text-[#4F6BFF] hover:bg-white/55 transition-colors cursor-pointer"
            >
              <Sparkles size={15} strokeWidth={2} className="text-[#4F6BFF] shrink-0" />
              <span className="truncate">{t('sidebar.tour')}</span>
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#4F6BFF]/10 text-[#4F6BFF] tracking-wide">
                {t('sidebar.tour.demo')}
              </span>
            </button>
            <button
              onClick={() => navigate('/einstellungen')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium text-foreground/85 hover:text-foreground hover:bg-white/55 transition-colors cursor-pointer"
            >
              <Settings size={15} strokeWidth={1.9} className="opacity-90 shrink-0" />
              <span className="truncate">{t('common.settings')}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 mb-2">
            <div className="flex justify-center">
              <NotificationBell />
            </div>
            <Tip label={t('sidebar.tour')}>
              <button
                onClick={handleStartTour}
                aria-label={t('sidebar.tour')}
                className="w-full flex items-center justify-center py-2 rounded-md cursor-pointer text-[#4F6BFF] hover:bg-white/40 transition-colors"
              >
                <Sparkles size={17} strokeWidth={2} />
              </button>
            </Tip>
            <Tip label={t('common.settings')}>
              <button
                onClick={() => navigate('/einstellungen')}
                aria-label={t('common.settings')}
                className="w-full flex items-center justify-center py-2 rounded-md cursor-pointer text-foreground/60 hover:text-foreground hover:bg-white/40 transition-colors"
              >
                <Settings size={17} strokeWidth={1.9} />
              </button>
            </Tip>
          </div>
        )}

        {/* Mode Switch — bold gradient background, signals it's a switchable control */}
        <div className="relative mb-2" ref={modeRef} data-tour="mode-switch">
          {open ? (
            <button
              onClick={() => setModeOpen(!modeOpen)}
              aria-label={t('mode.switch.aria', { label: modeLabel })}
              className={cn(
                'group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-left transition-all duration-200',
                'shadow-[0_4px_12px_-2px_rgba(15,23,42,0.18)] hover:shadow-[0_6px_16px_-2px_rgba(15,23,42,0.24)]',
                'ring-1 ring-white/40 hover:ring-white/60',
                'bg-gradient-to-br',
                modeGradient,
              )}
            >
              <div className="size-7 rounded-md flex items-center justify-center flex-shrink-0 bg-white/25 ring-1 ring-white/40 backdrop-blur-sm">
                <ModeIcon size={14} className="text-white drop-shadow-sm" strokeWidth={2.4} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-white leading-[1.15] drop-shadow-sm">{modeLabel}</p>
                <p className="text-[10.5px] text-white/85 truncate leading-[1.2] mt-0.5">{t('mode.switch.toLabel', { target: nextModeLabel })}</p>
              </div>
              <div className="size-6 rounded-md bg-white/20 ring-1 ring-white/30 flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors">
                <ArrowLeftRight size={11} className="text-white" strokeWidth={2.4} />
              </div>
            </button>
          ) : (
            <Tip label={t('mode.switch.tooltip', { label: modeLabel })}>
              <button
                onClick={() => setModeOpen(!modeOpen)}
                aria-label={t('mode.switch.aria', { label: modeLabel })}
                className="w-full flex items-center justify-center py-2 rounded-md cursor-pointer hover:bg-white/40 transition-colors"
              >
                <div className={cn(
                  'relative size-9 rounded-lg flex items-center justify-center ring-1 ring-white/40 shadow-[0_3px_10px_-2px_rgba(15,23,42,0.22)] bg-gradient-to-br',
                  modeGradient,
                )}>
                  <ModeIcon size={15} className="text-white drop-shadow-sm" strokeWidth={2.4} />
                  <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-white flex items-center justify-center ring-1 ring-card-line">
                    <ArrowLeftRight size={7} className="text-foreground/70" strokeWidth={2.6} />
                  </div>
                </div>
              </button>
            </Tip>
          )}
          {modeOpen && (
            <div className={cn(
              'absolute z-[70] bottom-full mb-1 bg-dropdown border border-dropdown-line rounded-lg shadow-lg p-1',
              open ? 'left-0 right-0' : 'left-0 w-[220px]'
            )}>
              {(['buyhold', 'fixflip', 'private'] as const).map(m => {
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
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm',
                      mode === m ? 'bg-primary/10 text-primary font-medium' : 'text-dropdown-item-foreground hover:bg-dropdown-item-hover'
                    )}
                  >
                    <div className={cn('size-8 rounded-lg flex items-center justify-center ring-1 ring-white/40', itemTint)}>
                      <ItemIcon size={14} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{itemLabel}</p>
                      <p className="text-xs text-muted-foreground">{itemDesc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* User — large avatar + name + email row, like the screenshot */}
        <div className="relative" ref={profileRef}>
          {open ? (
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-3 w-full px-2.5 py-2.5 rounded-xl transition-colors cursor-pointer hover:bg-white/55 group"
            >
              <div className="size-10 rounded-full bg-gradient-to-br from-[#4F6BFF] to-[#6B5BFF] flex items-center justify-center flex-shrink-0 ring-2 ring-white/80 shadow-[0_2px_6px_rgba(79,107,255,0.20)]">
                <span className="text-[14px] font-bold text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[13.5px] font-semibold text-foreground truncate leading-[1.2]">{userName || 'User'}</p>
                <p className="text-[11px] text-foreground/55 truncate leading-[1.2] mt-0.5">{userEmail || ''}</p>
              </div>
              <ChevronDown size={13} className={cn('transition-transform text-foreground/55 flex-shrink-0', profileOpen && 'rotate-180')} strokeWidth={2.2} />
            </button>
          ) : (
            <Tip label={userName || t('sidebar.profile')}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label={t('sidebar.profile')}
                className="w-full flex items-center justify-center py-2 cursor-pointer rounded-md hover:bg-white/40 transition-colors"
              >
                <div className="size-8 rounded-full bg-gradient-to-br from-[#4F6BFF] to-[#6B5BFF] flex items-center justify-center ring-2 ring-white/70 shadow-sm">
                  <span className="text-xs font-bold text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
                </div>
              </button>
            </Tip>
          )}
          {profileOpen && (
            <div className={cn(
              'absolute bottom-full mb-1 py-1 z-[70] bg-dropdown border border-dropdown-line rounded-lg shadow-lg',
              open ? 'left-0 right-0' : 'left-0 w-48'
            )}>
              <div className="px-3 py-2 border-b border-dropdown-divider">
                <p className="text-sm font-semibold text-dropdown-item-foreground">{userName || 'User'}</p>
                <p className="text-xs text-muted-foreground">{userEmail || ''}</p>
              </div>
              <div className="py-1">
                <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors cursor-pointer text-sm text-muted-foreground hover:bg-dropdown-item-hover">
                  <LogOut size={14} /> {t('sidebar.logout')}
                </button>
              </div>
            </div>
          )}
        </div>

        {!open && (
          <Tip label={t('sidebar.expand')}>
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label={t('sidebar.expand')}
              className="w-full flex items-center justify-center py-2 rounded-lg cursor-pointer mt-0.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-nav-hover"
            >
              <PanelLeftOpen size={20} strokeWidth={1.9} />
            </button>
          </Tip>
        )}
      </div>
    </aside>
  );
}
