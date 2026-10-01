import { lazy, Suspense, useState } from 'react';
import '../styles/operating-rhythm.css';
const Workspace = lazy(() =>
  import('./OperatingRhythmWorkspace').then((m) => ({
    default: m.OperatingRhythm,
  })),
);
/** Load the optional planning workspace only when the student opens it. */
export function OperatingRhythm() {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>My operating rhythm · daily and weekly planning</summary>
      {open && (
        <Suspense fallback={<p role="status">Opening your plan…</p>}>
          <Workspace />
        </Suspense>
      )}
    </details>
  );
}
