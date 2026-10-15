import * as React from 'react';
/**
 * A process in named steps — shows the AI or system working instead of faking certainty.
 */
export interface StepStatusProps { steps: { label: string; state: "waiting" | "working" | "done" | "failed" }[]; label?: string; }
export declare function StepStatus(props: StepStatusProps): JSX.Element;
