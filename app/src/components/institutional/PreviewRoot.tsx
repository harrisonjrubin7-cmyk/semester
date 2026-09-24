import { lazy, Suspense, type ReactNode } from 'react';

const InstitutionalPreviewProvider = lazy(() =>
  import('./PreviewContext').then((module) => ({
    default: module.InstitutionalPreviewProvider,
  })),
);

export function InstitutionalPreviewRoot({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <InstitutionalPreviewProvider>{children}</InstitutionalPreviewProvider>
    </Suspense>
  );
}
