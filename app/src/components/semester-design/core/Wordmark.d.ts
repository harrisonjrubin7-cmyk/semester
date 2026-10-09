import * as React from 'react';
/**
 * The Semester lockup — three-slab mark + SEMESTER in Barlow Condensed caps; also exports `Mark`.
 */
export interface WordmarkProps { size?: number; metal?: boolean; showWord?: boolean; style?: React.CSSProperties; }
export declare function Wordmark(props: WordmarkProps): JSX.Element;
export declare function Mark(props: { size?: number; style?: React.CSSProperties; className?: string }): JSX.Element;
