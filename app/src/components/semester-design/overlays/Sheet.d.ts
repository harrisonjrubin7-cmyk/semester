import * as React from 'react';
/** Bottom sheet on mobile, window on desktop; the home of "Source & details". Modal: focus trap, Escape, scroll lock, focus return. Also exports `SourceDetails`. */
export interface SheetProps { title: string; children?: React.ReactNode; onClose?: () => void; inline?: boolean; actions?: React.ReactNode; description?: string; /** Set false when closing would lose unsaved work. */ closeOnScrim?: boolean; /** CSS selector for the element to focus on open. */ initialFocus?: string; }
export declare function Sheet(props: SheetProps): JSX.Element;
export declare function SourceDetails(props: { items: { label: string; value: React.ReactNode }[] }): JSX.Element;
