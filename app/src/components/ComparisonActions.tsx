import { lazy, Suspense } from 'react';
import { useAccountId } from '../state/store';
import type { ComparisonCandidate, ComparisonSurface } from '../lib/comparison-actions';
const Actions = lazy(() => import('./ComparisonActionsPanel'));
export interface ComparisonActionsProps {
  surface: ComparisonSurface;
  scope: string;
  title: string;
  options: ComparisonCandidate[];
  /** Optional canonical personal plan update. Never an official transaction. */
  onChoose?: (id: string) => boolean;
  decisionId?: string;
  decisionVersion?: string;
  accountId?: string | null;
}
export function ComparisonActions(props: ComparisonActionsProps) {
  const currentAccount = useAccountId();
  const accountId = props.accountId === undefined ? currentAccount : props.accountId;
  if (!props.options.length) return null;
  return <Suspense fallback={<p role="status">Loading comparison actions…</p>}>
    <Actions key={`${accountId || 'device'}:${props.scope}:${JSON.stringify(props.options)}`} {...props} accountId={accountId} />
  </Suspense>;
}
