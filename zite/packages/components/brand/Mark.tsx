// The Semester mark: three staggered slabs, drawn from the same data as the repo's app/src/components/mark.data.ts
// (GRID 512, WIDTH 76, SLOPE 32, slabs at x 128/218/308). Flat and currentColor, as the app draws it.
// Rules from the brand kit: alt text is always "Semester"; never stretch, rotate, outline, shadow, animate, or use the mark
// as a bullet, spinner or status icon; the repo records no meaning for the slabs, so no copy asserts one.
import type { CSSProperties } from 'react';

export const GRID = 512;
export const WIDTH = 76;
export const SLOPE = 32;
export const BARS = [
  { x: 128, top: 176, bottom: 388 },
  { x: 218, top: 65, bottom: 372 },
  { x: 308, top: 147, bottom: 415 },
] as const;

type Bar = (typeof BARS)[number];
const quad = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
export const slabPath = ({ x, top, bottom }: Bar) => quad([[x, top], [x + WIDTH, top + SLOPE], [x + WIDTH, bottom + SLOPE], [x, bottom]]);
export function bounds() {
  return {
    left: Math.min(...BARS.map((b) => b.x)), right: Math.max(...BARS.map((b) => b.x)) + WIDTH,
    top: Math.min(...BARS.map((b) => b.top)), bottom: Math.max(...BARS.map((b) => b.bottom)) + SLOPE,
  };
}
const B = bounds();
const W = B.right - B.left, H = B.bottom - B.top;
export const markWidth = (height: number) => (height * W) / H;

/** The flat, one-colour mark. `size` is its height in px; left off, CSS sizes it (see .brand-lock). */
export function Mark({ size, className, style, decorative }: { size?: number; className?: string; style?: CSSProperties; decorative?: boolean }) {
  return (
    <svg viewBox={`${B.left} ${B.top} ${W} ${H}`} {...(size === undefined ? {} : { width: markWidth(size), height: size })}
      className={className} style={style} fill="currentColor" role={decorative ? undefined : 'img'} aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : 'Semester'} focusable="false">
      {BARS.map((b) => <path key={b.x} d={slabPath(b)} />)}
    </svg>
  );
}

/** The lockup: mark, then SEMESTER in Barlow Condensed 600 capitals. The capitals are the logo; the name is "Semester". */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`brand-lock ${className ?? ''}`} aria-label="Semester" role="img">
      <Mark decorative />
      <span className="brand-wordmark" aria-hidden="true">Semester</span>
    </span>
  );
}
