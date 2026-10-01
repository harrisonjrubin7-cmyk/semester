import { lazy, Suspense } from 'react';
import { LoadingState } from './unity/States';
const QuickAddContent = lazy(() => import('./QuickAdd').then(module => ({default: module.QuickAdd})));
export function DeferredQuickAdd(props: {onClose: () => void}) {
  return <Suspense fallback={<LoadingState what="Quick Add" />}><QuickAddContent {...props} /></Suspense>;
}
