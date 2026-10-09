import { ClerkProvider } from '@clerk/react';
import type { ReactNode } from 'react';

/**
 * Loaded only for deployments that configure Clerk, keeping the optional
 * provider and its SDK off the critical path for every other deployment.
 */
export default function ClerkProviderBoundary({
  children,
  publishableKey,
}: {
  children: ReactNode;
  publishableKey: string;
}) {
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}
