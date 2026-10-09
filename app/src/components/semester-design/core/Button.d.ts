import * as React from 'react';
/**
 * Action button — one primary per decision region; 44px tall by default, condensed-caps-free label in Barlow Condensed 600.
 * @startingPoint section="Actions" subtitle="Action button — one primary per decision region; 44px tall by default, condensed" viewport="700x400"
 */
export interface ButtonProps { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "md" | "sm"; icon?: string; iconAfter?: string; block?: boolean; loading?: boolean; /** Visible text while loading; the real label stays available to screen readers. */ loadingLabel?: string; disabled?: boolean; /** Visible sentence under a disabled button explaining why. */ disabledReason?: string; children?: React.ReactNode; onClick?: (e: any) => void; type?: "button" | "submit" | "reset"; /** Renders an <a> (navigation, not actions). */ href?: string; 'aria-label'?: string; }
export declare function Button(props: ButtonProps): JSX.Element;
