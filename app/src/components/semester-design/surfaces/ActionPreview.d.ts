import * as React from 'react';
/**
 * What is about to happen, said before it happens — What happens / Exactly what / Who else / When / Cost / What stays / Taking it back. Missing recovery reads as irreversible.
 */
export interface ActionPreviewProps { subject?: string; says: React.ReactNode; exactly?: React.ReactNode; doesNotChange?: React.ReactNode; recovery: { kind: "undo" | "request" | "none"; how?: string }; subjectTo?: React.ReactNode; provenance?: React.ReactNode; affects?: React.ReactNode; effective?: React.ReactNode; cost?: React.ReactNode; }
export declare function ActionPreview(props: ActionPreviewProps): JSX.Element;
