import * as React from 'react';
/**
 * The universal decision card: eyebrow → title → provenance → why → metadata → one primary + one quiet secondary.
 * @startingPoint section="Surfaces" subtitle="The universal decision card: eyebrow → title → provenance → why → metadata → one" viewport="700x400"
 */
export interface ObjectCardProps { kind?: string; statuses?: string[]; title: string; provenance?: { origin: string; by?: string; cues?: string[]; age?: string }; explanation?: string; metadata?: string; primary?: { label: string; onClick?: () => void; disabled?: boolean; disabledReason?: string }; secondary?: { label: string; onClick?: () => void }; tone?: "pending" | "danger"; level?: 2 | 3 | 4; children?: React.ReactNode; /** Makes the title a link. */ href?: string; state?: 'ready' | 'loading' | 'unavailable'; stateText?: string; busy?: boolean; }
export declare function ObjectCard(props: ObjectCardProps): JSX.Element;
