import * as React from 'react';
/** Pre-prompt before the OS permission dialog: why, when, fallback, what's kept. Distinguishes denied, device-blocked, managed and unsupported. */
export interface PermissionPromptProps { capability: string; glyph?: string; why: React.ReactNode; when?: React.ReactNode; fallback?: React.ReactNode; kept?: React.ReactNode; allowLabel?: string; onAllow?: () => void; onNotNow?: () => void; onUseFallback?: () => void; fallbackLabel?: string; state?: "ask" | "requesting" | "granted" | "denied" | "blocked" | "unsupported" | "managed"; managedBy?: string; settingsHint?: string; }
export declare function PermissionPrompt(props: PermissionPromptProps): JSX.Element;
