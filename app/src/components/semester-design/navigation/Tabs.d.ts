import * as React from 'react';
/** In-page tabs. Keyboard: one tab stop, arrows/Home/End. Pass idBase and use TabPanel to wire aria-controls. Also exports TabPanel. */
export interface TabItem { id: string; label: string; count?: number | string; disabled?: boolean; }
export interface TabsProps { items: TabItem[]; current?: string; onChange?: (id: string) => void; label?: string; idBase?: string; /** Arrows move focus only; Enter/Space selects. */ manual?: boolean; }
export declare function Tabs(props: TabsProps): JSX.Element;
export declare function TabPanel(props: { idBase: string; id: string; current?: string; children?: React.ReactNode }): JSX.Element;
