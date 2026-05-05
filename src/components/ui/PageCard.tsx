import { useState } from 'react';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PageCardTab<K extends string = string> {
  key: K;
  label: string;
  count?: number;
  /** Optional warning tone (e.g. amber/rose) used for the count when it's > 0. */
  tone?: 'default' | 'warn' | 'danger';
}

interface PageCardProps<K extends string = string> {
  /** Big title shown inside the card header (replaces page-header pattern). */
  title: string;
  /** Description shown below the title. */
  description?: ReactNode;
  /** Small inline meta line above the title (e.g. "12 Vorgänge · 3 überfällig"). */
  meta?: ReactNode;
  /** Right-side action button(s) in the header. */
  actions?: ReactNode;
  /** Underline-style filter tabs. Active tab is highlighted in primary blue. */
  tabs?: ReadonlyArray<PageCardTab<K>>;
  activeTab?: K;
  onTabChange?: (key: K) => void;
  /** Optional extra controls in the tabs row (right-aligned, before the search). */
  tabExtras?: ReactNode;
  /** Search input value + handler. If omitted, no search is shown. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Footer shown at the bottom (typically the X-of-Y counter). */
  footer?: ReactNode;
  /** Padding on the body container. Set to 'flush' to remove (when content
      brings its own divide-y / row layout). Default 'flush'. */
  bodyPadding?: 'flush' | 'comfortable';
  children: ReactNode;
}

/**
 * Flat page shell — Bloggo/Stratify style: title + description floats freely,
 * filters row sits below (no card border), content renders unwrapped.
 * Consumers wrap tables/lists in their own card if needed.
 */
export function PageCard<K extends string = string>({
  title,
  description,
  meta,
  actions,
  tabs,
  activeTab,
  onTabChange,
  tabExtras,
  search,
  onSearchChange,
  searchPlaceholder = 'Suchen...',
  footer,
  bodyPadding = 'flush',
  children,
}: PageCardProps<K>) {
  const hasFiltersRow = !!(tabs?.length || onSearchChange || tabExtras);
  return (
    <div>
      {/* Header — flat, no card wrap. Title/description left, actions right */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 sm:mb-6 px-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.15] mb-1.5">
            {title}
          </h1>
          {description && (
            <p className="text-[14px] text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 mt-1">{actions}</div>}
      </div>
      {meta ? <span className="hidden">{meta}</span> : null}

      {/* Filters row — flat, sits below the header with bottom border */}
      {hasFiltersRow && (
        <div className="flex items-center gap-3 flex-wrap mb-4 pb-3 border-b border-card-line px-1">
          {tabs?.length ? (
            <div className="flex items-center gap-3 sm:gap-4 -mb-3 flex-wrap min-w-0">
              {tabs.map((t) => {
                const isActive = t.key === activeTab;
                const tone = t.tone ?? 'default';
                return (
                  <button
                    key={t.key}
                    onClick={() => onTabChange?.(t.key)}
                    className={cn(
                      'group relative inline-flex items-center gap-1.5 pb-3 text-[13.5px] font-medium transition-colors cursor-pointer',
                      isActive ? 'text-[#4F6BFF]' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.label}
                    {typeof t.count === 'number' && (
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums',
                          isActive
                            ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]'
                            : tone === 'warn'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                              : tone === 'danger'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                                : 'bg-layer-hover text-muted-foreground/80',
                        )}
                      >
                        {t.count}
                      </span>
                    )}
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex-1" />

          {tabExtras}

          {onSearchChange !== undefined && (
            <PageCardSearch
              value={search ?? ''}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          )}
        </div>
      )}

      {/* Body — content renders inside a clean white card so tables/rows have a frame */}
      <div className={cn(
        'bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden',
        bodyPadding === 'comfortable' && 'p-5 sm:p-6',
      )}>
        {children}
        {footer && (
          <div className="px-5 sm:px-7 py-3 border-t border-card-divider">
            <p className="text-[11.5px] text-muted-foreground tabular-nums">{footer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PageCardSearch({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={cn(
          'h-8 pl-7 pr-3 rounded-md text-[12px] text-foreground placeholder:text-muted-foreground/70 transition-all',
          'border focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15',
          focused
            ? 'bg-card border-[#4F6BFF]/40 w-[220px]'
            : 'bg-layer-hover border-transparent hover:border-card-line w-[160px]',
        )}
      />
    </div>
  );
}

/** Inline empty-state shown inside a PageCard when filters return nothing. */
export function PageCardNoResults({ message = 'Keine Einträge gefunden.' }: { message?: string }) {
  return (
    <div className="text-center py-10 px-5">
      <Search size={20} className="mx-auto mb-2 text-muted-foreground/60" />
      <p className="text-[13px] text-muted-foreground">{message}</p>
    </div>
  );
}
