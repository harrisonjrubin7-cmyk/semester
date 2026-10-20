import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { ErrorState, LoadingState, PermissionState } from '../unity/States';
import { Table, type Column } from '../unity/Table';
import { FieldMessage, fieldProps } from '../FieldMessage';
import { Field, Result, Row, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import {
  accountIdProblem, bindPerson, courseLabel, grantLabel, loadRosterDesk, personName, setAbsence, stale,
  type RosterConfig, type RosterDesk as Desk, type UnboundPerson,
} from '../../lib/roster/admin';

/**
 * The roster desk: for a school administrator holding `roster:administer`,
 * the roster people nobody has bound to a Semester account, binding one, and
 * the school's absence-means-removal switch.
 *
 * Built from the same parts as the registration hold desk (`HoldDesk`): a
 * consequential write goes through `ConfirmDialog` with an `ActionPreview`
 * that says what changes and what does not; the key is kept across a retry
 * after a lost reply (`useAttempts`); a write's answer is shown once, by
 * `Result`. The list is the shared `Table`, stacked on a phone.
 *
 * Binding names an account by its id, pasted: Semester has no people search
 * for administrators yet. Nothing is matched by email, here or in the
 * database. The rules — who may, which school, never one's own account, no
 * second binding — are the database's (`roster-admin-desk.check.sql`).
 */

/** The server returns at most this many unbound people. */
const LIST_LIMIT = 1000;

export function RosterDesk({ tenantId }: { tenantId: string }) {
  const [desk, setDesk] = useState<Desk | null | string>(null);
  const [reads, setReads] = useState(0);
  const reload = () => setReads((n) => n + 1);

  useEffect(() => {
    let live = true;
    loadRosterDesk(tenantId).then(
      (d) => { if (live) setDesk(d); },
      (e: unknown) => { if (live) setDesk(e instanceof Error ? e.message : 'Could not load the roster.'); },
    );
    return () => { live = false; };
  }, [tenantId, reads]);

  if (desk === null) return <LoadingState what="the roster" bars={[30, 62, 96]} />;
  if (typeof desk === 'string') {
    return <ErrorState title="Could not load the roster" body={`${desk} Nothing has changed.`} recover={{ label: 'Load again', run: reload }} />;
  }
  if (desk.state === 'not-set-up') {
    return (
      <EmptyState
        title="The roster desk is not set up here yet"
        body="This school’s account service does not have the roster desk yet. Whoever runs the deployment applies it; until then bindings and the absence setting stay with Semester support."
      />
    );
  }
  if (desk.state === 'denied') {
    return (
      <PermissionState
        title="You cannot use the roster desk"
        body={desk.message}
        owner="your school’s university or integration administrator, who grants roster:administer"
      />
    );
  }
  return (
    <>
      <Absence tenantId={tenantId} config={desk.config} reload={reload} />
      <Unbound tenantId={tenantId} people={desk.people} reload={reload} />
    </>
  );
}

// ── Absence means removal ──────────────────────────────────────────────────

function Absence({ tenantId, config, reload }: { tenantId: string; config: RosterConfig; reload: () => void }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const on = config.absenceRevokesAccess;

  async function flip(): Promise<void> {
    setBusy(true);
    setSaid(null);
    try {
      const r = await attempt(`roster-absence:${on ? 'off' : 'on'}`, (key) => setAbsence(tenantId, !on, on, key));
      const text =
        r.outcome === 'turned-on'
          ? `Absence-means-removal is on. ${r.revoked === 1 ? '1 roster-given course grant ended' : `${r.revoked} roster-given course grants ended`}.`
          : r.outcome === 'turned-off'
            ? 'Absence-means-removal is off. A complete roster that leaves someone out no longer ends their access.'
            : `Absence-means-removal was already ${r.on ? 'on' : 'off'}. Nothing was changed.`;
      setSaid({ tone: 'ok', text: text + (r.replayed ? ' (Already recorded — nothing was sent twice.)' : '') });
      say(text);
      setConfirming(false);
      reload();
    } catch (e) {
      const text = e instanceof Error ? e.message : 'The setting was not changed.';
      setConfirming(false);
      if (stale(e)) {
        setSaid({ tone: 'refused', text: 'Someone changed this setting since you loaded it, so nothing was changed. The desk has been loaded again: check it before trying again.' });
        reload();
      } else {
        setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void flip() });
      }
    } finally {
      setBusy(false);
    }
  }

  const reach = config.rosterComplete
    ? config.wouldEnd === 0
      ? 'No roster-given course grant would end now: everyone the roster gave access to is still on it.'
      : `${config.wouldEnd === 1 ? '1 roster-given course grant' : `${config.wouldEnd} roster-given course grants`} would end as soon as you confirm.`
    : 'Nothing ends yet: the roster in place is not a complete one. It starts to apply when a complete roster is promoted.';

  return (
    <>
      <SectionLabel aside={on ? 'On' : 'Off'}>Absence from the roster</SectionLabel>
      <Result said={said} />
      {!config.configured ? (
        <Notice>Roster import is not set up for this school, so there is nothing to switch. Semester support sets up the import.</Notice>
      ) : (
        <>
          <p>
            {on
              ? 'On. People missing from a complete roster lose the course access the roster gave them.'
              : 'Off. People missing from the roster keep their course access until the roster marks them inactive. This is the default.'}
          </p>
          <Row>
            <button type="button" className="btn" disabled={busy} onClick={() => { setSaid(null); setConfirming(true); }}>
              {on ? 'Turn off absence-means-removal' : 'Turn on absence-means-removal'}
            </button>
          </Row>
        </>
      )}
      {confirming && (
        <ConfirmDialog
          title={on ? 'Turn off absence-means-removal?' : 'Turn on absence-means-removal?'}
          preview={
            on ? (
              <ActionPreview
                subject="Absence-means-removal · off"
                says="People missing from a complete roster keep their roster-given course access. Only a roster that marks someone inactive ends it."
                doesNotChange="Access that has already ended does not come back by itself: it returns when the roster lists the person again."
                recovery={{ kind: 'undo', how: 'Turn it on again here.' }}
              />
            ) : (
              <ActionPreview
                subject="Absence-means-removal · on"
                says="People missing from a complete roster lose roster-given course access."
                exactly={reach}
                doesNotChange="Access an administrator, an LTI launch or SCIM gave is never taken back by the roster. A partial roster never removes anyone."
                subjectTo="Your roster source may stop sharing someone without them having left. Turn this on only if your school treats the roster as the whole truth."
                recovery={{ kind: 'request', how: 'turn it off here; access that ended comes back when the roster lists the person again.' }}
              />
            )
          }
          confirmLabel={busy ? 'Saving…' : on ? 'Turn it off' : 'Turn it on'}
          onCancel={() => { if (!busy) setConfirming(false); }}
          onConfirm={() => { if (!busy) void flip(); }}
        />
      )}
    </>
  );
}

// ── People without an account ─────────────────────────────────────────────

function Unbound({ tenantId, people, reload }: { tenantId: string; people: UnboundPerson[]; reload: () => void }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [choosing, setChoosing] = useState<UnboundPerson | null>(null);
  const [account, setAccount] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);

  function review() {
    const p = accountIdProblem(account);
    setProblem(p ?? undefined);
    if (!p) setConfirming(true);
  }

  async function bind(person: UnboundPerson, id: string): Promise<void> {
    setBusy(true);
    setSaid(null);
    try {
      const r = await attempt(`roster-bind:${person.sourcedId}:${id}`, (key) => bindPerson(tenantId, person.sourcedId, id, key));
      const gets = r.grants.length ? `They now have ${r.grants.map(grantLabel).join('; ')}.` : 'The roster gives them no course yet.';
      const text = r.outcome === 'bound'
        ? `${personName(person)} is bound to account ${id}. ${gets}`
        : `${personName(person)} was already bound to that account. Nothing was changed.`;
      setSaid({ tone: 'ok', text: text + (r.replayed ? ' (Already recorded — nothing was sent twice.)' : '') });
      say(text);
      setConfirming(false);
      setChoosing(null);
      setAccount('');
      reload();
    } catch (e) {
      const text = e instanceof Error ? e.message : 'The binding was not made.';
      setConfirming(false);
      setSaid(settled(e) ? { tone: 'refused', text: `${text} Nothing was changed.` } : { tone: 'unknown', text, retry: () => void bind(person, id) });
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<UnboundPerson>[] = [
    { id: 'name', header: 'Person', rowHeader: true, cell: (p) => <>{personName(p)}<br /><small>{p.sourcedId}</small></> },
    { id: 'role', header: 'Roster role', cell: (p) => p.role || '—' },
    {
      id: 'courses', header: 'A binding gives',
      cell: (p) => (p.courses.length ? p.courses.map(courseLabel).join('; ') : 'No course yet'),
    },
    {
      id: 'act', header: 'Action',
      cell: (p) => (
        <button type="button" className="btn" disabled={busy} onClick={() => { setSaid(null); setProblem(undefined); setAccount(''); setChoosing(p); }}>
          Bind {personName(p)}
        </button>
      ),
    },
  ];

  return (
    <>
      <SectionLabel aside={people.length ? `${people.length}${people.length >= LIST_LIMIT ? '+' : ''} unbound` : undefined}>People without an account</SectionLabel>
      <Result said={said} />
      {people.length >= LIST_LIMIT && (
        <Notice>Showing the first {LIST_LIMIT}, by family name. Bind these and the rest appear.</Notice>
      )}
      <Table
        caption="Roster people with no Semester account bound"
        captionHidden
        columns={columns}
        rows={people}
        rowKey={(p) => p.sourcedId}
        compact="stack"
        empty={
          <EmptyState
            inline
            title="Everyone on the roster has an account"
            body="Every person on your school’s live roster is bound to a Semester account. New people appear here when the next roster is promoted."
          />
        }
      />
      {choosing && !confirming && (
        <section aria-label={`Bind ${personName(choosing)}`}>
          <SectionLabel>Bind {personName(choosing)}</SectionLabel>
          <Field
            label="Semester account id"
            hint="The account that is this person. It must be at your school, and it cannot be your own. Semester has no people search for administrators yet, so paste the id; nothing is matched by email."
          >
            {(ids) => (
              <>
                <input
                  aria-label="Semester account id"
                  {...fieldProps(ids.id, problem, ids.hint)}
                  className="input"
                  value={account}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setAccount(e.target.value)}
                />
                <FieldMessage id={ids.id} error={problem} />
              </>
            )}
          </Field>
          <Row>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={review}>Review the binding</button>
            <button type="button" className="btn" disabled={busy} onClick={() => setChoosing(null)}>Cancel</button>
          </Row>
        </section>
      )}
      {choosing && confirming && (
        <ConfirmDialog
          title={`Bind ${personName(choosing)}?`}
          preview={
            <ActionPreview
              subject={`${personName(choosing)} · ${choosing.sourcedId} → account ${account.trim()}`}
              says="Links this roster person to that Semester account. The account gets the course access the roster lists for them, now and on every roster from here on."
              exactly={choosing.courses.length ? choosing.courses.map(courseLabel).join('; ') : 'No course yet: the roster lists none for them.'}
              doesNotChange="The account’s sign-in, its email and anything already in it. Nothing is matched by email."
              recovery={{ kind: 'none', how: 'There is no unbind in Semester yet; a wrong binding has to be corrected by Semester support.' }}
            />
          }
          confirmLabel={busy ? 'Binding…' : 'Bind'}
          onCancel={() => { if (!busy) setConfirming(false); }}
          onConfirm={() => { if (!busy) void bind(choosing, account.trim()); }}
        />
      )}
    </>
  );
}
