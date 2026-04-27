import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useTour } from '../../context/TourContext';
import { useAppMode } from '../../context/AppModeContext';
import { tourSteps } from './tourSteps';
import { cn, getDefaultDashboard, getDashboardRoute } from '../../lib/utils';

const ACCENTS: Record<string, string> = {
  blue: 'from-[#4F6BFF] to-[#6B7FFF]',
  emerald: 'from-emerald-500 to-emerald-400',
  amber: 'from-amber-500 to-amber-400',
  violet: 'from-violet-500 to-violet-400',
};

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface CardPosition {
  top: number;
  left: number;
  placement: 'center' | 'bottom' | 'top' | 'left' | 'right';
}

interface Arrow {
  path: string;
  headX: number;
  headY: number;
  angle: number;
}

const CARD_WIDTH = 420;
const CARD_HEIGHT_APPROX = 280;
const CARD_GAP = 48; // larger gap gives the arrow visible room to curve
const VIEWPORT_MARGIN = 16;
// AppLayout switches between mobile (sidebar slides in as overlay, bottom nav visible)
// and desktop at the Tailwind `lg` breakpoint (1024px). The tour must follow the
// same breakpoint so spotlight targeting only runs when desktop chrome is mounted.
const DESKTOP_BREAKPOINT = 1024;
// Height of the MobileBottomNav (h-14 = 56px). We keep the card clear of it.
const MOBILE_BOTTOM_NAV_HEIGHT = 56;

function computeArrow(
  placement: CardPosition['placement'],
  cardRect: { left: number; top: number; width: number; height: number },
  target: Rect
): Arrow | null {
  if (placement === 'center') return null;

  const tCenterX = target.left + target.width / 2;
  const tCenterY = target.top + target.height / 2;

  // Pick a start point on the card's target-facing edge (offset OUTSIDE the
  // card by GAP so we clear the card shadow), and an end point just INSIDE
  // the target's card-facing edge so the tip meets the glow ring.
  const GAP = 22; // distance from card edge to arrow start (clears shadow)
  const IN_TARGET = 3; // penetration into target
  // Tangent "stiffness": how strongly the curve leaves each endpoint
  // perpendicular to the adjacent edge. Larger → more pronounced S-shape.
  const STIFF_NEAR = 55; // near the card
  const STIFF_FAR = 70; // near the target

  let sx = 0, sy = 0, ex = 0, ey = 0;
  let c1x = 0, c1y = 0, c2x = 0, c2y = 0;

  switch (placement) {
    case 'bottom': {
      // Card is BELOW target → arrow flows UP
      sx = cardRect.left + Math.min(90, cardRect.width * 0.28);
      sy = cardRect.top - GAP;
      ex = Math.max(target.left + 24, Math.min(tCenterX, target.left + target.width - 24));
      ey = target.top + target.height - IN_TARGET;
      c1x = sx;
      c1y = sy - STIFF_NEAR; // leave card perpendicular (straight up)
      c2x = ex;
      c2y = ey + STIFF_FAR; // arrive at target perpendicular (from below)
      break;
    }
    case 'top': {
      // Card is ABOVE target → arrow flows DOWN
      sx = cardRect.left + Math.min(90, cardRect.width * 0.28);
      sy = cardRect.top + cardRect.height + GAP;
      ex = Math.max(target.left + 24, Math.min(tCenterX, target.left + target.width - 24));
      ey = target.top + IN_TARGET;
      c1x = sx;
      c1y = sy + STIFF_NEAR;
      c2x = ex;
      c2y = ey - STIFF_FAR;
      break;
    }
    case 'right': {
      // Card is RIGHT of target → arrow flows LEFT
      sx = cardRect.left - GAP;
      sy = cardRect.top + Math.min(90, cardRect.height * 0.35);
      ex = target.left + target.width - IN_TARGET;
      ey = Math.max(target.top + 24, Math.min(tCenterY, target.top + target.height - 24));
      c1x = sx - STIFF_NEAR;
      c1y = sy;
      c2x = ex + STIFF_FAR;
      c2y = ey;
      break;
    }
    case 'left': {
      // Card is LEFT of target → arrow flows RIGHT
      sx = cardRect.left + cardRect.width + GAP;
      sy = cardRect.top + Math.min(90, cardRect.height * 0.35);
      ex = target.left + IN_TARGET;
      ey = Math.max(target.top + 24, Math.min(tCenterY, target.top + target.height - 24));
      c1x = sx + STIFF_NEAR;
      c1y = sy;
      c2x = ex - STIFF_FAR;
      c2y = ey;
      break;
    }
  }

  // Arrow-head angle = tangent at end = direction from c2 → e
  const tx = ex - c2x;
  const ty = ey - c2y;
  const angle = (Math.atan2(ty, tx) * 180) / Math.PI;

  const f = (n: number) => n.toFixed(1);
  return {
    path: `M ${f(sx)} ${f(sy)} C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(ex)} ${f(ey)}`,
    headX: ex,
    headY: ey,
    angle,
  };
}

export function TourOverlay() {
  const { active, currentStep, endTour, nextStep, prevStep } = useTour();
  const { setMode } = useAppMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<CardPosition | null>(null);
  const [arrow, setArrow] = useState<Arrow | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  // Bumped whenever the card element's measured height changes. Card-position
  // recomputation depends on this so we always use the up-to-date height —
  // avoids the "position was computed against the previous step's card height"
  // glitch that made re-runs of the tour look different from the first run.
  const [cardHeightTick, setCardHeightTick] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = tourSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === tourSteps.length - 1;

  // Fertig-Handler: beendet die Tour und navigiert zum Standard-Dashboard
  // (Einstellungen → Allgemein → Standard-Dashboard, Default `buyhold`). Setzt
  // gleichzeitig den App-Mode, damit die Sidebar-Navigation konsistent ist.
  const handleFinish = () => {
    endTour();
    const target = getDefaultDashboard();
    setMode(target);
    navigate(getDashboardRoute(target));
  };

  // When the step changes, switch mode + navigate as required
  useEffect(() => {
    if (!active || !step) return;
    if (step.mode) {
      setMode(step.mode);
    }
    if (step.route && step.route !== location.pathname) {
      navigate(step.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, currentStep]);

  // Measure the target element + viewport. Re-runs on resize, scroll, step change,
  // and after layout changes triggered by route/mode transitions.
  useLayoutEffect(() => {
    if (!active || !step) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let attempts = 0;

    const measure = () => {
      if (cancelled) return;
      setViewport({ w: window.innerWidth, h: window.innerHeight });

      if (!step.targetSelector) {
        setTargetRect(null);
        return;
      }

      const el = document.querySelector(step.targetSelector) as HTMLElement | null;
      if (!el) {
        // Retry up to ~1.5s — the target may mount after navigation.
        if (attempts < 30) {
          attempts++;
          rafId = window.setTimeout(measure, 50) as unknown as number;
        } else {
          setTargetRect(null);
        }
        return;
      }

      // Ensure target is visible
      const rect = el.getBoundingClientRect();

      // Detect elements that are hidden via `display:none` or zero-sized
      // (common for `lg:hidden` / responsive chrome that doesn't apply).
      const isInvisible = rect.width === 0 || rect.height === 0;
      if (isInvisible) {
        setTargetRect(null);
        return;
      }

      const outOfView =
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth;
      if (outOfView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        // Re-measure after scroll animation settles
        if (attempts < 10) {
          attempts++;
          rafId = window.setTimeout(measure, 150) as unknown as number;
          return;
        }
        // If scrolling can't bring it into view (e.g. element is translated
        // off-screen like a collapsed mobile sidebar), give up on spotlight
        // and fall back to a centered modal rather than pointing at garbage.
        setTargetRect(null);
        return;
      }

      const pad = step.spotlightPad ?? 8;
      setTargetRect({
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    };

    measure();

    const onResize = () => measure();
    const onScroll = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelled = true;
      if (rafId) clearTimeout(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [active, currentStep, location.pathname, step]);

  // Observe card height changes. Step content varies (title, description, tip),
  // so the card's rendered height differs per step. Without this, the position
  // effect would sometimes read a stale height (previous step's) and land the
  // card at the wrong coordinates — which is what made restarting the tour
  // look different from the first run.
  useEffect(() => {
    if (!active) return;
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === 'undefined') return;
    let lastH = card.offsetHeight;
    const observer = new ResizeObserver(() => {
      const h = card.offsetHeight;
      if (h !== lastH) {
        lastH = h;
        setCardHeightTick((t) => t + 1);
      }
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [active]);

  // Compute card position relative to the target
  useLayoutEffect(() => {
    if (!active || !step) return;
    if (!targetRect || viewport.w === 0) {
      setCardPos(null);
      setArrow(null);
      return;
    }

    const cardH = cardRef.current?.offsetHeight ?? CARD_HEIGHT_APPROX;
    const cardW = Math.min(CARD_WIDTH, viewport.w - VIEWPORT_MARGIN * 2);

    const spaceBelow = viewport.h - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;
    const spaceRight = viewport.w - (targetRect.left + targetRect.width);
    const spaceLeft = targetRect.left;

    let placement: CardPosition['placement'] = 'bottom';
    let top = 0;
    let left = 0;

    if (spaceBelow >= cardH + CARD_GAP + VIEWPORT_MARGIN) {
      placement = 'bottom';
      top = targetRect.top + targetRect.height + CARD_GAP;
      left = targetRect.left + targetRect.width / 2 - cardW / 2;
    } else if (spaceAbove >= cardH + CARD_GAP + VIEWPORT_MARGIN) {
      placement = 'top';
      top = targetRect.top - cardH - CARD_GAP;
      left = targetRect.left + targetRect.width / 2 - cardW / 2;
    } else if (spaceRight >= cardW + CARD_GAP + VIEWPORT_MARGIN) {
      placement = 'right';
      left = targetRect.left + targetRect.width + CARD_GAP;
      top = targetRect.top + targetRect.height / 2 - cardH / 2;
    } else if (spaceLeft >= cardW + CARD_GAP + VIEWPORT_MARGIN) {
      placement = 'left';
      left = targetRect.left - cardW - CARD_GAP;
      top = targetRect.top + targetRect.height / 2 - cardH / 2;
    } else {
      placement = 'center';
      top = viewport.h / 2 - cardH / 2;
      left = viewport.w / 2 - cardW / 2;
    }

    // Clamp to viewport
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewport.w - cardW - VIEWPORT_MARGIN));
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, viewport.h - cardH - VIEWPORT_MARGIN));

    setCardPos({ top, left, placement });
    setArrow(
      computeArrow(
        placement,
        { left, top, width: cardW, height: cardH },
        targetRect
      )
    );
    // cardHeightTick is intentionally a dep: when the card's rendered height
    // changes (different step content), we must recompute position/arrow with
    // the new height.
  }, [targetRect, viewport, active, step, currentStep, cardHeightTick]);

  if (!active || !step) return null;

  const Icon = step.icon;
  const accentClass = ACCENTS[step.accent] || ACCENTS.blue;
  // Match AppLayout's `lg` breakpoint (1024px). Below this, the sidebar is an
  // off-canvas overlay and MobileBottomNav occupies the bottom — we can't reliably
  // spotlight sidebar targets, so use a centered/bottom-sheet modal instead.
  const isMobile = viewport.w > 0 && viewport.w < DESKTOP_BREAKPOINT;
  const useSpotlight = !!targetRect && !isMobile;
  const useCenteredModal = !targetRect || isMobile;
  const cardW = Math.min(CARD_WIDTH, viewport.w - VIEWPORT_MARGIN * 2);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop — SVG mask for spotlight cutout, plain overlay otherwise */}
      {useSpotlight ? (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-auto"
          style={{ cursor: 'default' }}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect!.left}
                y={targetRect!.top}
                width={targetRect!.width}
                height={targetRect!.height}
                rx="12"
                ry="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.68)"
            mask="url(#tour-spotlight-mask)"
          />
          {/* Glow ring around target */}
          <rect
            x={targetRect!.left}
            y={targetRect!.top}
            width={targetRect!.width}
            height={targetRect!.height}
            rx="12"
            ry="12"
            fill="none"
            stroke="#4F6BFF"
            strokeWidth="2"
            style={{
              filter: 'drop-shadow(0 0 12px rgba(79, 107, 255, 0.6))',
            }}
          >
            <animate
              attributeName="stroke-opacity"
              values="1;0.5;1"
              dur="2s"
              repeatCount="indefinite"
            />
          </rect>

        </svg>
      ) : (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto" />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        className={cn(
          'absolute pointer-events-auto',
          // Centered modal covers both: no spotlight target available, or mobile/tablet
          // (below lg breakpoint). At <sm: bottom-sheet with room for MobileBottomNav.
          // At ≥sm: centered dialog.
          useCenteredModal && 'inset-0 flex items-end sm:items-center justify-center'
        )}
        style={
          useCenteredModal && isMobile
            ? {
                // Leave room for MobileBottomNav (only visible < lg, always visible when
                // isMobile is true under the new breakpoint rules).
                paddingBottom: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
              }
            : !useCenteredModal && cardPos
            ? {
                top: cardPos.top,
                left: cardPos.left,
                width: cardW,
              }
            : undefined
        }
      >
        <div
          className={cn(
            'bg-card border border-card-line rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 relative',
            (useCenteredModal || isMobile) ? 'w-full sm:max-w-md sm:m-4' : 'w-full'
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              'size-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-md',
              accentClass
            )}
          >
            <Icon size={22} className="text-white" strokeWidth={2.2} />
          </div>

          {/* Title + description */}
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">{step.title}</h2>
          <p className="text-sm text-muted-foreground-2 leading-relaxed">{step.description}</p>
          {step.tip && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
              <p className="text-xs font-medium text-primary">{step.tip}</p>
            </div>
          )}

          {/* Progress */}
          <div className="flex items-center gap-1.5 mt-5">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  i === currentStep
                    ? 'w-6 bg-primary'
                    : i < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-muted'
                )}
              />
            ))}
            <span className="ml-auto text-xs font-medium text-muted-foreground tabular-nums">
              {currentStep + 1} / {tourSteps.length}
            </span>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2 mt-5">
            {!isLast && (
              <button
                onClick={endTour}
                className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors px-2 py-1.5"
              >
                Überspringen
              </button>
            )}
            <div className="flex-1" />
            {!isFirst && (
              <button onClick={prevStep} className="btn btn-md btn-secondary">
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Zurück</span>
              </button>
            )}
            <button onClick={isLast ? handleFinish : nextStep} className="btn btn-md btn-primary">
              {isLast ? (
                <>
                  <Check size={14} />
                  Fertig
                </>
              ) : (
                <>
                  Weiter
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Arrow — top-most layer: sits above both spotlight and card */}
      {arrow && useSpotlight && (
        <svg
          key={`arrow-${currentStep}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="tour-arrow-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="1.5"
                stdDeviation="1.5"
                floodColor="#1e1b4b"
                floodOpacity="0.25"
              />
            </filter>
          </defs>

          {/* Line */}
          <path
            d={arrow.path}
            fill="none"
            stroke="#4F6BFF"
            strokeWidth="2.25"
            strokeLinecap="round"
            filter="url(#tour-arrow-shadow)"
            style={{
              animation: 'tourArrowDraw 0.6s cubic-bezier(0.65, 0, 0.35, 1) forwards',
              strokeDasharray: 800,
              strokeDashoffset: 800,
            }}
          />

          {/* Head — simple clean triangle, oriented along end tangent */}
          <g
            transform={`translate(${arrow.headX} ${arrow.headY}) rotate(${arrow.angle})`}
            style={{
              animation: 'tourArrowHead 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards',
              opacity: 0,
            }}
            filter="url(#tour-arrow-shadow)"
          >
            <path
              d="M 1 0 L -10 -5 L -10 5 Z"
              fill="#4F6BFF"
              stroke="#4F6BFF"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          </g>

          <style>
            {`
              @keyframes tourArrowDraw {
                to { stroke-dashoffset: 0; }
              }
              @keyframes tourArrowHead {
                to { opacity: 1; }
              }
            `}
          </style>
        </svg>
      )}
    </div>
  );
}
