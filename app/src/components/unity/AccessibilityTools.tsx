import { lazy, Suspense } from 'react';
import { ToolDisclosure } from './ToolDisclosure';
import type { Look } from '../../lib/look';
const AccessibilityPanel = lazy(() => import('./AccessibilityPanel'));
export type AccessibilityToolsProps = { look: Look; onChange: (look: Look) => void; onSettings: () => void; context?: string };
/** Load on first use and retain narration when the menu closes. */
export function AccessibilityTools(props: AccessibilityToolsProps) {
  return <ToolDisclosure label="Accessibility tools" trigger="Accessibility" className="system-accessibility" width={544} lazy>
      {close => <Suspense fallback={<p role="status">Loading accessibility tools…</p>}><AccessibilityPanel {...props} onSettings={() => { close(); props.onSettings(); }} /></Suspense>}
  </ToolDisclosure>;
}
