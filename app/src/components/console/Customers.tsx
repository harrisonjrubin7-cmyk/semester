import { useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import { loadCustomers, CONSOLE_CAPABILITY, type Customer } from '../../lib/console/client';
import { ACCESS_BASIS, CLASSIFICATION_MEANING, RECORD_KINDS, type Classification } from '../../lib/ops/console';
import { Fields, inScope, matches, said, when, type ViewProps } from './Fields';

/**
 * Tenants, customers, commitments and contracts.
 *
 * Every record names its classification from `RECORD_KINDS`, and answers the
 * five `ACCESS_BASIS` questions — why this operator can see it. The purpose
 * is typed before anything is read, because "the ticket, incident or change
 * the read is for" is a field the operator supplies, not one the database
 * can guess; a read with no purpose is the browsing the support duty forbids.
 *
 * Demo tenants are left out by the reader unless asked for, and in production
 * an empty list says so rather than showing an illustrative institution.
 */
const COMMITMENT = RECORD_KINDS.find((k) => k.kind === 'Customer commitment');

/** The customer and its contract are company operations: internal, like the commitment they carry. */
const CUSTOMER_CLASS: Classification = COMMITMENT?.classification ?? 'internal';

export function classificationSaid(c: Classification): string {
  return `${c} — ${CLASSIFICATION_MEANING[c]}`;
}

export function Customers({ env, scope, filter, onStatus, sessionEnds, onFocus }: ViewProps & { sessionEnds: string; onFocus: (tenantId: string) => void }) {
  const [purpose, setPurpose] = useState('');
  const [includeDemo, setIncludeDemo] = useState(false);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [busy, setBusy] = useState(false);

  const read = async () => {
    setBusy(true);
    try {
      setCustomers(await loadCustomers(includeDemo));
    } catch (e) {
      setCustomers([]);
      onStatus(said(e, 'Could not read the customers.'));
    } finally {
      setBusy(false);
    }
  };

  const basis = (c: Customer, what: string) =>
    ACCESS_BASIS.map((f) => ({
      field: f.field,
      value:
        f.field === 'Basis'
          ? `${CONSOLE_CAPABILITY} at platform scope, from your live role grant`
          : f.field === 'Tenant'
            ? c.tenantId
            : f.field === 'Scope'
              ? what
              : f.field === 'Purpose'
                ? purpose.trim()
                : sessionEnds,
    }));

  const shown = (customers ?? []).filter((c) => inScope(scope, c.tenantId) && matches(filter, c.legalName, c.tenantId, c.status, c.ownerSeat));

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <form
        aria-label="Purpose of this read"
        onSubmit={(e) => {
          e.preventDefault();
          void read();
        }}
        style={{ display: 'grid', gap: 'var(--sp-3)' }}
      >
        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          Purpose of this read — the ticket, incident or change it is for
          <input className="input" required minLength={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </label>
        {env !== 'Production' && (
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
            Include demo tenants (never offered in production)
          </label>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || purpose.trim().length < 3}>
          Read customers
        </button>
      </form>

      {customers !== null && (
        <>
          <SectionLabel aside={`${shown.length}`}>Customers</SectionLabel>
          {shown.length === 0 && <Notice>No production customers yet in this scope. Nothing illustrative is shown here: a demo tenant is a demo tenant.</Notice>}
          {shown.map((c) => (
            <article key={c.id} className="portal-panel" aria-label={`Customer ${c.legalName}`} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
              <strong>
                {c.legalName || c.schoolName || c.tenantId}
                {c.isDemo ? ' (demo)' : ''}
              </strong>
              <div style={{ color: 'var(--app-dim)' }}>
                Tenant {c.tenantId}
                {c.schoolName ? ` — ${c.schoolName}` : ''} · {c.status} · owner seat {c.ownerSeat || 'unassigned'} · updated {when(c.updatedAt, 'never')}
              </div>
              <div>Classification: {classificationSaid(CUSTOMER_CLASS)}</div>
              <Fields label={`Why you can see ${c.legalName}`} items={basis(c, 'Customer record')} />
              <div>
                <button type="button" className="btn" onClick={() => onFocus(c.tenantId)}>
                  Scope the console to this tenant
                </button>
              </div>

              <SectionLabel aside={`${c.commitments.length}`}>Commitments</SectionLabel>
              {c.commitments.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No commitments recorded.</p>}
              {c.commitments.map((m) => (
                <div key={m.id} style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  <div>
                    <strong>{m.commitmentId}</strong> · {m.status} · due {m.dueOn ?? 'no date'} · evidence {m.evidence ?? 'none'}
                  </div>
                  <div>Classification: {classificationSaid(COMMITMENT?.classification ?? 'internal')}</div>
                  <Fields label={`Why you can see commitment ${m.commitmentId}`} items={basis(c, `Commitment ${m.commitmentId}`)} />
                </div>
              ))}

              <SectionLabel aside={`${c.contracts.length}`}>Contracts</SectionLabel>
              {c.contracts.length === 0 && <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No contracts recorded.</p>}
              {c.contracts.map((k) => (
                <div key={k.id} style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  <div>
                    <strong>{k.kind}</strong> · signed {k.signedOn ?? 'not yet'} · {k.startsOn ?? '?'} to {k.endsOn ?? 'open'} · {k.documentRef ?? 'no document reference'}
                  </div>
                  <div>Classification: {classificationSaid(CUSTOMER_CLASS)}</div>
                  <Fields label={`Why you can see contract ${k.kind}`} items={basis(c, `Contract ${k.kind}`)} />
                </div>
              ))}
            </article>
          ))}
        </>
      )}
    </div>
  );
}
