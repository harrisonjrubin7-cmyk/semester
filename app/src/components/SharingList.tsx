import { useDeviceLibrary } from '../lib/device-library';
import { EMPTY_FAMILY, readFamily } from '../lib/family';
import { checkSupporterPlan } from '../lib/sharing';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';

/**
 * Everything this student is sharing, or planning to, in one list.
 *
 * Today every row is a plan on this device: no share with a real person
 * exists until the server side of `docs/CONSENT-SHARING-DESIGN.md` is
 * approved and built, and the list says so rather than implying otherwise.
 * What it does now is hold each plan to the rules that share will be held to
 * (`lib/sharing.ts`), so a plan that could never be shared as it stands — no
 * end date, nothing chosen, payment access — says why here, before anyone is
 * asked to accept it.
 */
export function SharingList({ today = new Date().toLocaleDateString('en-CA') }: { today?: string }) {
  const { account, dispatch } = useStore();
  const family = useDeviceLibrary(`semester.family.v1:${account?.id || 'device'}`, readFamily, EMPTY_FAMILY);
  const rows = family.value.members.map((m) => ({ member: m, check: checkSupporterPlan(m, family.value.items, today) }));

  return (
    <section aria-labelledby="sharing-title">
      <SectionLabel style={{ marginTop: 'calc(22px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(5px * var(--density, 1))' }}>
        <span id="sharing-title">Sharing</span>
      </SectionLabel>
      <p className="sharing-lead">
        Nothing is shared with anyone yet. These are plans kept on this device. When sharing turns on, each one goes
        to one named person, for the items you choose, until the date you set — and you see every time it is read.
      </p>
      {family.error ? (
        // Unreadable plans are not "no plans": say so, rather than list nothing as if nothing were planned.
        <p role="alert" className="sharing-lead">
          Your plans could not be read on this device. Open Family to recover them.
        </p>
      ) : rows.length === 0 ? (
        <p className="sharing-lead">No plans. A plan for a parent or supporter starts in Family.</p>
      ) : (
        <ul className="sharing-list">
          {rows.map(({ member, check }) => (
            <li key={member.id}>
              <strong>{member.name || 'Unnamed person'}</strong>
              {member.relationship && <span> · {member.relationship}</span>}
              <div className="sharing-meta">
                Plan on this device · {check.items.length} {check.items.length === 1 ? 'item' : 'items'}
                {member.expires ? ` · until ${member.expires}` : ''}
              </div>
              {check.problems.length > 0 ? (
                <ul className="sharing-problems" aria-label={`Before ${member.name || 'this plan'} could be shared`}>
                  {check.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <div className="sharing-meta">Ready to share once sharing turns on.</div>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'go', screen: 'family' })}>
        Open Family
      </button>
    </section>
  );
}
