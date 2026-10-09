import * as React from 'react';
/**
 * A fact's origin chip plus at most two cues and its age, spoken as one sentence.
 */
export interface ProvenanceChipsProps { origin: string; by?: string; cues?: string[]; age?: string; }
export declare function ProvenanceChips(props: ProvenanceChipsProps): JSX.Element;
