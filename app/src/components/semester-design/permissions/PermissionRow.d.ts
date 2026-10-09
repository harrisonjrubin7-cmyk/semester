import * as React from 'react';
/** One device capability with its state, use and change action. Managed/unsupported states have no toggle. */
export interface PermissionRowProps { capability: string; use: React.ReactNode; state?: "on" | "off" | "ask" | "blocked" | "limited" | "managed" | "unsupported"; detail?: React.ReactNode; onChange?: () => void; lastUsed?: string; managedBy?: string; busy?: boolean; }
export declare function PermissionRow(props: PermissionRowProps): JSX.Element;
