import * as React from 'react';
/**
 * The small uppercase kicker that heads a section, with an optional right-aligned count.
 */
export interface SectionLabelProps { children: React.ReactNode; aside?: React.ReactNode; as?: "h2" | "h3" | "h4"; style?: React.CSSProperties; }
export declare function SectionLabel(props: SectionLabelProps): JSX.Element;
