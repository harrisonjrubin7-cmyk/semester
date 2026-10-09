import * as React from 'react';
/**
 * A governed assistant answer — labelled AI-assisted with data scope, numbered sources, confidence, request cost and policy.
 * @startingPoint section="AI" subtitle="A governed assistant answer — labelled AI-assisted with data scope, numbered sou" viewport="700x400"
 */
export interface AIResponseProps {
  children?: React.ReactNode;
  scope?: string[];
  sources?: { title: string; kind?: string; href?: string; excerpt?: string }[];
  confidence?: string; cost?: string; policy?: string; actions?: React.ReactNode; model?: string;
  state?: 'streaming' | 'done' | 'error' | 'refused';
  error?: string; onRetry?: () => void; refusal?: string;
  /** Actions the assistant suggests; each needs explicit Confirm. */
  proposals?: { label: string; onConfirm?: () => void; onDecline?: () => void }[];
  onFeedback?: (v: 'up' | 'down') => void;
  generatedAt?: string;
}
export declare function AIResponse(props: AIResponseProps): JSX.Element;
