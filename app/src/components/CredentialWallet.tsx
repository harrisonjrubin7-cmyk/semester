import { useMemo, useState } from 'react';
import { EMPTY_EVIDENCE, evidenceKey, readEvidence } from '../lib/career-evidence';
import { walletExport, walletItems } from '../lib/credential-wallet';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import type { SkillClaim } from '../lib/skills-graph';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';

export function CredentialWallet({ claims }: { claims: SkillClaim[] }) {
  const { state, account } = useStore();
  const evidence = useDeviceLibrary(evidenceKey(account?.id, state.term), readEvidence, EMPTY_EVIDENCE);
  const items = useMemo(() => walletItems(claims, evidence.value), [claims, evidence.value]);
  const [selected, setSelected] = useState<string[]>([]);
  const [said, setSaid] = useState('');

  const toggle = (id: string) => setSelected((before) => before.includes(id) ? before.filter((item) => item !== id) : [...before, id]);
  const exportSelected = () => {
    const payload = walletExport(items, selected, new Date().toISOString());
    download({ name: 'Semester credential wallet.json', body: JSON.stringify(payload, null, 2), mime: 'application/json' });
    setSaid(`${payload.items.length} item${payload.items.length === 1 ? '' : 's'} exported. Nothing was shared.`);
  };

  return (
    <section className="credential-wallet" aria-labelledby="credential-wallet-title">
      <SectionLabel aside="Private by default">Credential wallet</SectionLabel>
      <h3 id="credential-wallet-title" className="balance-heading">Carry evidence you chose</h3>
      <p className="portal-muted">
        This wallet holds only skills you confirmed and artifacts you selected. Authority stays attached to every item. It is not an official transcript, badge, or institution-issued credential.
      </p>
      {evidence.error ? <p role="alert">{evidence.error}</p> : null}
      {items.length ? (
        <fieldset className="credential-wallet-list">
          <legend className="sr-only">Choose wallet items to export</legend>
          {items.map((item) => (
            <label key={item.id}>
              <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
              <span>
                <strong>{item.title}</strong>
                <span>{item.authority} · {item.kind === 'skill' ? 'Skill' : 'Evidence artifact'}</span>
                <small>{item.evidence.join(' · ') || 'No evidence label recorded'}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="portal-muted">Confirm a suggested skill or add a portfolio artifact under Evidence to place it here.</p>
      )}
      <div className="portal-actions">
        <button type="button" className="balance-button" disabled={!selected.length} onClick={exportSelected}>Export selected</button>
        {selected.length ? <button type="button" className="balance-button" onClick={() => setSelected([])}>Clear selection</button> : null}
      </div>
      <p className="portal-muted">Named-recipient sharing and institution-issued credentials stay unavailable until an authorized issuer and revocation service are connected.</p>
      {said ? <p role="status" className="balance-said">{said}</p> : null}
    </section>
  );
}
