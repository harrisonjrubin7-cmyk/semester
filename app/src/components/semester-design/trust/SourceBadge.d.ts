import * as React from 'react';
/**
 * Where a fact came from, beside the fact — controlled vocabulary (glyph + word + tone).
 * @startingPoint section="Trust & provenance" subtitle="Where a fact came from, beside the fact — controlled vocabulary (glyph + word + " viewport="700x400"
 */
export interface SourceBadgeProps { source: "official" | "connected" | "imported" | "personal" | "ai" | "estimated" | "review" | "stale" | "external" | "sample"; updated?: string; by?: string; onReport?: () => void; /** ISO date for <time>. */ datetime?: string; /** Forces the stale treatment. */ stale?: boolean; /** What the report is about, for the button's accessible name. */ about?: string; }
export declare function SourceBadge(props: SourceBadgeProps): JSX.Element;
