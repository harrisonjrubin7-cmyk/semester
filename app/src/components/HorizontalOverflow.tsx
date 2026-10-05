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
import { prefersLessMotion } from '../lib/prefers';
import { ChevronLeft, ChevronRight } from './Icons';

type Position = {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
};

const RESTING: Position = { overflowing: false, atStart: true, atEnd: true };

function outerLayoutStyle(style?: CSSProperties): CSSProperties | undefined {
  if (!style) return undefined;
  const outer: CSSProperties = {};
  if (style.alignSelf !== undefined) outer.alignSelf = style.alignSelf;
  if (style.flex !== undefined) outer.flex = style.flex;
  else {
    if (style.flexBasis !== undefined) outer.flexBasis = style.flexBasis;
    if (style.flexGrow !== undefined) outer.flexGrow = style.flexGrow;
    if (style.flexShrink !== undefined) outer.flexShrink = style.flexShrink;
  }
  if (style.gridArea !== undefined) outer.gridArea = style.gridArea;
  else {
    if (style.gridColumn !== undefined) outer.gridColumn = style.gridColumn;
    if (style.gridRow !== undefined) outer.gridRow = style.gridRow;
  }
  if (style.justifySelf !== undefined) outer.justifySelf = style.justifySelf;
  if (style.margin !== undefined) outer.margin = style.margin;
  else {
    if (style.marginBlock !== undefined) outer.marginBlock = style.marginBlock;
    if (style.marginInline !== undefined) outer.marginInline = style.marginInline;
  }
  if (style.maxHeight !== undefined) outer.maxHeight = style.maxHeight;
  if (style.maxWidth !== undefined) outer.maxWidth = style.maxWidth;
  if (style.minHeight !== undefined) outer.minHeight = style.minHeight;
  if (style.minWidth !== undefined) outer.minWidth = style.minWidth;
  if (style.order !== undefined) outer.order = style.order;
  return outer;
}

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
  const outerStyle = outerLayoutStyle(style);

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
      behavior: prefersLessMotion() ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="overflow-cue" style={outerStyle}>
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
