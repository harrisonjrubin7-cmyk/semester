import * as React from 'react';
/** Health band with score, trend and top driver. Missing or stale data shows "Not enough data", never "Healthy". */
export interface HealthBadgeProps { band?: "healthy" | "watch" | "atrisk" | "unknown"; score?: number; outOf?: number; driver?: string; updated?: string; trend?: 'up' | 'down' | 'flat'; stale?: boolean; }
export declare function HealthBadge(props: HealthBadgeProps): JSX.Element;
