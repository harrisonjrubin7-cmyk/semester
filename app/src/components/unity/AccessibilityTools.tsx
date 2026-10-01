import { lazy, Suspense, useState } from 'react';
import type { Look } from '../../lib/look';
const AccessibilityPanel = lazy(() => import('./AccessibilityPanel'));
export type AccessibilityToolsProps = { look: Look; onChange: (look: Look) => void; onSettings: () => void; context?: string };
/** Load on first use and retain narration when the menu closes. */
export function AccessibilityTools(props: AccessibilityToolsProps) {
  const [opened, setOpened] = useState(false);
  return <details className="system-accessibility" onToggle={event => { if (event.currentTarget.open) setOpened(true); }}>
    <summary className="tap-y">Accessibility</summary>
    {opened && <Suspense fallback={<p role="status">Loading accessibility tools…</p>}><AccessibilityPanel {...props} /></Suspense>}
  </details>;
}
