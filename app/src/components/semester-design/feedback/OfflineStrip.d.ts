import * as React from 'react';
/**
 * Offline strip that says what still works and that changes are queued.
 */
export interface OfflineStripProps { queued?: number; syncs?: boolean; }
export declare function OfflineStrip(props: OfflineStripProps): JSX.Element;
