import React from 'react';
import { ICON_SHAPES } from '../icons/iconShapes.js';
/** Semester glyph — Lucide-like, 24 grid, stroke 1.5, round caps. Decorative unless `label` is given.
 * Hardened: unknown names render a visible placeholder square (and warn once in development) instead of an invisible gap; size clamps to ≥ 12; title inside the svg when labelled. */
const warned = new Set();
export function Icon({ name, size = 19, label, strokeWidth = 1.5, style, className }) {
  const shapes = ICON_SHAPES[name];
  if (!shapes && name && !warned.has(name) && typeof console !== 'undefined') { warned.add(name); console.warn('Icon: unknown name "' + name + '". See ICON_NAMES.'); }
  const s = Math.max(12, Number(size) || 19);
  const kids = shapes ? shapes.map((p, i) => p.c ? React.createElement('circle', { key: i, cx: p.c[0], cy: p.c[1], r: p.c[2] }) : React.createElement('path', { key: i, d: p.d })) : [React.createElement('rect', { key: 'x', x: 5, y: 5, width: 14, height: 14, rx: 2, strokeDasharray: '2 2' })];
  if (label) kids.unshift(React.createElement('title', { key: 't' }, label));
  return React.createElement('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', className, style: { display: 'block', flex: 'none', ...style }, 'aria-hidden': label ? undefined : 'true', role: label ? 'img' : undefined, 'aria-label': label, focusable: 'false', 'data-missing': shapes ? undefined : 'true' }, kids);
}
export const ICON_NAMES = Object.keys(ICON_SHAPES);
