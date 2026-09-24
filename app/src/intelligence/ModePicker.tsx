import { effectiveIntegrityMode, type IntegrityMode, type IntegrityPolicy } from './contracts';

const MODES: { id: IntegrityMode; label: string }[] = [
  { id: 'explain', label: 'Explain' },
  { id: 'hint', label: 'Hint' },
  { id: 'practice', label: 'Practice' },
  { id: 'review', label: 'Review' },
  { id: 'draft', label: 'Draft' },
];

export function IntegrityModePicker({
  requested,
  policy,
  onChange,
}: {
  requested: IntegrityMode;
  policy: IntegrityPolicy;
  onChange: (mode: IntegrityMode) => void;
}) {
  const decision = effectiveIntegrityMode(requested, policy);
  return (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <div
        role="group"
        aria-label="Academic integrity mode"
        style={{ display: 'flex', gap: 'var(--sp-2)', overflowX: 'auto', paddingBottom: 'var(--sp-1)' }}
      >
        {MODES.map(({ id, label }) => {
          const allowed = policy.allowed.includes(id);
          return (
            <button
              key={id}
              type="button"
              className="bare"
              aria-disabled={!allowed}
              aria-pressed={decision.effective === id}
              onClick={() => {
                if (allowed) onChange(id);
              }}
              style={{
                width: 'auto',
                flex: 'none',
                minHeight: 30,
                padding: '0 var(--sp-4)',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--app-line)',
                background: decision.effective === id ? 'var(--app-accent-wash)' : 'transparent',
                color: allowed ? 'var(--app-fg)' : 'var(--app-dim)',
                fontSize: 'var(--type-xs)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {decision.restricted && (
        <div style={{ marginTop: 'var(--sp-2)', color: 'var(--app-dim)', fontSize: 'var(--type-xs)' }}>
          {decision.reason}
        </div>
      )}
    </div>
  );
}
