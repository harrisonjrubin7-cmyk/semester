import * as React from 'react';
/**
 * Global search and command palette (⌘K) with keyboard selection.
 */
export interface CommandPaletteProps { groups: { label: string; items: { label: string; icon?: string; detail?: string }[] }[]; placeholder?: string; onSelect?: (item: any) => void; }
export declare function CommandPalette(props: CommandPaletteProps): JSX.Element;
