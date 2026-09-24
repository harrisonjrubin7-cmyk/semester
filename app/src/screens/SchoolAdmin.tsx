import { useStore } from '../state/store';
import { AI_CATEGORIES } from '../lib/aiflags';

/**
 * School administration console for AI capability configuration.
 *
 * Shows what categories of context the AI assistant can receive. Displays
 * the school's current configuration. Direct modification is a future feature —
 * for now, changes are made through the school pack system at provisioning.
 *
 * Restricted to school administrators — access control is the caller's concern.
 */
export function SchoolAdmin() {
  const { school } = useStore();

  // Current configuration of what's switched off
  const off = school.capabilities.aiOff ?? [];

  return (
    <div style={{ padding: 'var(--page-pad)', maxWidth: '60ch' }}>
      <h2 style={{ marginTop: 0, fontSize: 'var(--type-lg)', fontWeight: 600 }}>AI Assistant Configuration</h2>

      <p style={{ color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)' }}>
        Configure what information the AI assistant can access. This school-wide setting affects all students.
        Each category is <strong>on</strong> by default — toggle off to prevent the assistant from receiving that data.
      </p>

      <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
        {AI_CATEGORIES.map((category) => {
          const isSwitchedOff = off.includes(category.id);
          return (
            <div
              key={category.id}
              style={{
                padding: 'var(--sp-4)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--app-line)',
                background: isSwitchedOff ? 'rgba(200, 100, 100, 0.1)' : 'var(--chrome)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-3)' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 var(--sp-1) 0', fontSize: 'var(--type-base-plus)' }}>
                    {category.label}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--type-sm)',
                      color: 'var(--app-dim)',
                      lineHeight: 'var(--leading-relaxed)',
                    }}
                  >
                    {category.blurb}
                  </p>
                </div>
                <div
                  style={{
                    paddingTop: 'calc(8px * var(--density, 1))',
                    paddingBottom: 'calc(8px * var(--density, 1))',
                    paddingLeft: 'calc(16px * var(--density, 1))',
                    paddingRight: 'calc(16px * var(--density, 1))',
                    fontSize: 'var(--type-sm)',
                    fontWeight: isSwitchedOff ? 'bold' : 'normal',
                    color: isSwitchedOff ? '#c44' : '#484',
                    background: 'transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isSwitchedOff ? '⊘ Off' : '✓ On'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 'var(--sp-6)',
          padding: 'var(--sp-3)',
          borderRadius: 'var(--radius)',
          background: 'var(--chrome)',
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          lineHeight: 'var(--leading-relaxed)',
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Current configuration:</strong> {off.length === 0 ? 'All categories enabled' : `${off.length} switched off`}
        </p>
        {off.length > 0 && (
          <p style={{ margin: 'var(--sp-1) 0 0 0' }}>
            {off.map((c) => AI_CATEGORIES.find((cat) => cat.id === c)?.label).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
