import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { Result, RowItem, Rows, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime } from '../../lib/locale';
import { loadOfficeHolds, officeName, resolveHold, type OfficeHold } from '../../lib/enrollment/client';

/**
 * The office half of a registration hold: the holds one office placed, and
 * resolving one of them.
 *
 * Shown for an account holding `registration_hold:resolve` over an office
 * scope at this school (`holdOffices`). The office sees which student account
 * and since when, never a reason — the same rule as the student's own view.
 * Resolving is the one consequential action here, so it goes through
 * `ConfirmDialog` with an `ActionPreview` that says what changes and, as
 * plainly, what does not: nobody is enrolled by it. The key is kept across a
 * retry after a lost reply (`useAttempts`), and the database refuses a hold
 * another office owns, a hold already released, and the same key reused.
 */

const shortId = (id: string) => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

const when = (iso: string) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : formatDateTime(at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export function HoldDesk({ offices }: { offices: readonly string[] }) {
  return (
    <>
      {offices.map((office) => (
        <OfficeHolds key={office} office={office} />
      ))}
    </>
  );
}

function OfficeHolds({ office }: { office: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [holds, setHolds] = useState<OfficeHold[] | null | string>(null);
  const [reads, setReads] = useState(0);
  const [confirming, setConfirming] = useState<OfficeHold | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const name = officeName(office);

  useEffect(() => {
    let live = true;
    loadOfficeHolds(office).then(
      (v) => { if (live) setHolds(v); },
      (e: unknown) => { if (live) setHolds(e instanceof Error ? e.message : 'Could not load this office’s holds.'); },
    );
    return () => { live = false; };
  }, [office, reads]);

  async function resolve(hold: OfficeHold): Promise<void> {
    setBusy(true);
    setSaid(null);
    try {
      const a = await attempt(`hold:${hold.holdId}`, (key) => resolveHold(hold.holdId, key, 'held'));
      setSaid({ tone: a.ok ? 'ok' : 'refused', text: a.message + (a.replayed ? ' (Already recorded — nothing was sent twice.)' : '') });
      if (a.ok) say(a.message);
      setConfirming(null);
      setReads((n) => n + 1);
    } catch (e) {
      const text = e instanceof Error ? e.message : 'The hold was not resolved.';
      setConfirming(null);
      setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void resolve(hold) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionLabel aside={Array.isArray(holds) && holds.length ? `${holds.length} open` : undefined}>Holds placed by {name}</SectionLabel>
      <Result said={said} />
      {typeof holds === 'string' ? (
        <>
          <Notice alert>{holds} Nothing has changed.</Notice>
          <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
            Load again
          </button>
        </>
      ) : holds === null ? (
        <p role="status">Loading {name}’s holds…</p>
      ) : holds.length === 0 ? (
        <EmptyState inline title="No open holds" body={`${name} has no registration hold open in Semester. Holds arrive from your school’s student information system.`} />
      ) : (
        <Rows label={`Holds placed by ${name}`}>
          {holds.map((h) => (
            <RowItem key={h.holdId}>
              <div>
                <strong>Student account {shortId(h.student)}</strong>
                <Sub>Placed {when(h.placedAt)} · blocks adding courses, never dropping</Sub>
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => { setSaid(null); setConfirming(h); }}>
                Resolve the hold on {shortId(h.student)}
              </button>
            </RowItem>
          ))}
        </Rows>
      )}
      {confirming && (
        <ConfirmDialog
          title="Resolve this registration hold?"
          preview={
            <ActionPreview
              subject={`${name} hold · student account ${shortId(confirming.student)}`}
              says={`Releases the hold ${name} placed. The student can add courses again unless something else stops them, and any readiness worked out while the hold stood is marked out of date.`}
              doesNotChange="This is not enrollment. The student is not registered in anything; seats, prerequisites, the registration window and any other office’s hold are all checked again when they enroll. Your school’s own system is not updated by Semester."
              recovery={{ kind: 'request', how: 'place the hold again in your school’s student information system.' }}
            />
          }
          confirmLabel={busy ? 'Resolving…' : 'Resolve the hold'}
          onCancel={() => { if (!busy) setConfirming(null); }}
          onConfirm={() => { if (!busy) void resolve(confirming); }}
        />
      )}
    </>
  );
}
