import { useMemo, useState } from 'react';
import { controlPlaneView, type ControlPlaneInput } from '../../lib/control-plane';
import { Blueprint } from '../Blueprint';
import { ActionButton, SectionLabel } from '../ui';

export function ControlPlane({ input, onApply }: { input: ControlPlaneInput; onApply?: () => Promise<{ receiptId: string }> }) {
  const view = useMemo(() => controlPlaneView(input), [input]);
  const [message, setMessage] = useState('');

  return (
    <section className="control-plane" aria-label="University control plane">
      <div className="control-plane-heading">
        <div>
          <span className="kicker">University control plane</span>
          <h2>Policy, access and evidence</h2>
          <p>{view.authorization}</p>
        </div>
        <span className="control-plane-tenant">Tenant · {input.viewedTenantId}</span>
      </div>

      <div className="control-plane-grid">
        {view.sections.map((item) => (
          <Blueprint plain key={item.id} style={{ padding: 'var(--sp-6)' }}>
            <SectionLabel style={{ marginBlock: 0 }}>{item.title}</SectionLabel>
            <div className="control-plane-status">{item.status}</div>
            <p>{item.detail}</p>
          </Blueprint>
        ))}
      </div>

      <div className="control-plane-actions">
        <ActionButton
          onClick={() => setMessage('Policy change staged locally for review. Nothing was published.')}
        >
          Stage local policy change
        </ActionButton>
        <ActionButton
          tone="primary"
          disabled={!view.canCreateProductionReceipt || !onApply}
          onClick={() => {
            setMessage('Applying through the verified gateway…');
            void onApply?.().then(
              ({ receiptId }) => setMessage(`Verified production receipt ${receiptId} returned by the institution gateway.`),
              () => setMessage('The gateway did not return a verified receipt. Nothing is shown as applied.'),
            );
          }}
        >
          Apply through verified gateway
        </ActionButton>
      </div>
      {(!view.canCreateProductionReceipt || !onApply) && (
        <p className="control-plane-note">
          Production changes require same-tenant authorization, production feature state and a
          production-verified gateway.
        </p>
      )}
      {message && <p role="status" className="control-plane-message">{message}</p>}
    </section>
  );
}
