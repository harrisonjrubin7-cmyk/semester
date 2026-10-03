import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronLeft, ChevronRight } from './Icons';

type Position = {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
};

const RESTING: Position = { overflowing: false, atStart: true, atEnd: true };

/**
 * A horizontally scrolling row with controls that exist only when it clips.
 *
 * Touch, wheel and keyboard focus keep using the browser's native scroller.
 * The two compact buttons are an additional visible affordance for people who
 * would not otherwise know that the clipped edge can move.
 */
export function HorizontalOverflow({
  label,
  children,
  className,
  style,
  role,
  onKeyDown,
  viewportRef,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  role?: AriaRole;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  viewportRef?: RefObject<HTMLDivElement | null>;
}) {
  const id = useId();
  const ownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>(RESTING);

  const remember = useCallback(
    (node: HTMLDivElement | null) => {
      ownRef.current = node;
      if (viewportRef) viewportRef.current = node;
    },
    [viewportRef],
  );

  const measure = useCallback(() => {
    const row = ownRef.current;
    if (!row) return;
    const remaining = row.scrollWidth - row.clientWidth;
    const next = {
      overflowing: remaining > 1,
      atStart: row.scrollLeft <= 1,
      atEnd: remaining <= 1 || row.scrollLeft >= remaining - 1,
    };
    setPosition((current) =>
      current.overflowing === next.overflowing &&
      current.atStart === next.atStart &&
      current.atEnd === next.atEnd
        ? current
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    const row = ownRef.current;
    if (!row) return;
    measure();
    row.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => measure());
    observer?.observe(row);
    for (const child of row.children) observer?.observe(child);
    return () => {
      row.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [children, measure]);

  const move = (direction: -1 | 1) => {
    const row = ownRef.current;
    if (!row) return;
    row.scrollBy({
      left: direction * Math.round(row.clientWidth * 0.85),
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="overflow-cue">
      {position.overflowing && (
        <div className="overflow-cue__controls" role="group" aria-label={`${label} scroll controls`}>
          <button
            type="button"
            className="overflow-cue__button"
            aria-label={`Scroll ${label} left`}
            aria-controls={id}
            title={`Scroll ${label} left`}
            disabled={position.atStart}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="overflow-cue__button"
            aria-label={`Scroll ${label} right`}
            aria-controls={id}
            title={`Scroll ${label} right`}
            disabled={position.atEnd}
            onClick={() => move(1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      <div
        id={id}
        ref={remember}
        role={role}
        aria-label={role ? label : undefined}
        className={`overflow-cue__viewport${className ? ` ${className}` : ''}`}
        style={style}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
