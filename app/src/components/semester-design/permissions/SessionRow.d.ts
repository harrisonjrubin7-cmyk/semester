import * as React from 'react';
/** A signed-in device with inline two-step remote sign-out; unrecognised sessions get a next step. */
export interface SessionRowProps { device: string; place?: string; lastActive?: string; method?: string; current?: boolean; onSignOut?: () => void; unrecognised?: boolean; signingOut?: boolean; onReport?: () => void; }
export declare function SessionRow(props: SessionRowProps): JSX.Element;
