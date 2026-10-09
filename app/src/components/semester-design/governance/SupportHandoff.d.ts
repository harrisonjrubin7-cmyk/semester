import * as React from 'react';
/** Hands a question to the owning office and tracks only its status. Lists what will be shared; failure keeps the draft. */
export interface SupportHandoffProps { office: string; reason?: string; channel?: string; hours?: string; status?: "ready" | "sending" | "sent" | "received" | "waiting" | "resolved" | "failed"; reference?: string; onStart?: () => void; onRetry?: () => void; shares?: string[]; expected?: string; urgent?: string; updated?: string; }
export declare function SupportHandoff(props: SupportHandoffProps): JSX.Element;
