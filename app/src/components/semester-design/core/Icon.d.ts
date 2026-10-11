import * as React from 'react';
/**
 * Semester line glyph (Lucide-like, 24 grid, 1.5 stroke) from the app's own icon set — 108 names, see assets/icons/.
 * @startingPoint section="Glyph" subtitle="Semester line glyph (Lucide-like, 24 grid, 1.5 stroke) from the app's own icon s" viewport="700x400"
 */
export interface IconProps { name: string; size?: number; label?: string; strokeWidth?: number; style?: React.CSSProperties; className?: string; }
export declare function Icon(props: IconProps): JSX.Element;
export declare const ICON_NAMES: string[];
