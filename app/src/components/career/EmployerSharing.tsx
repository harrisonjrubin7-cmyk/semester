import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { cloudConfigured } from '../../lib/cloud';
import { goMine } from '../../lib/openmine';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { DateField } from '../unity/DateField';
import { ErrorState, LoadingState, PermissionState } from '../unity/States';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { dateToIso } from '../../lib/date';
import { formatDate, formatDateTime } from '../../lib/locale';
import { ObjectsError, listMine, listVersions, type VersionEntry, type WorkspaceObject } from '../../lib/workspace/objects';
import {
  addEvidence,
  loadPortfolio,
  MAX_SHARE_DAYS,
  MAX_SHARE_ITEMS,
  revokeEmployer,
  shareProblem,
  shareWithEmployer,
  withdrawEvidence,
  type EmployerAccess,
  type Evidence,
  type Portfolio,
} from '../../lib/workspace/evidence';

/** The end of the chosen day, on this device's clock. */
const endOfDay = (iso: string): string => new Date(`${iso}T23:59:59`).toISOString();

/**
 * The student's side of sharing evidence with an employer (D-1670), in
 * Career › Employers.
 *
 * Evidence is an exact saved version of one of the student's own documents
 * (Mine › Documents), with a label they write. They share named pieces with
 * one employer account until a date at most 180 days away, see who can read
 * what and until when, and end it at once. Grades are not part of this.
 *
 * Every write names the portfolio revision this screen read; if anything
 * changed in between the server answers `stale`, writes nothing, and the
 * screen offers to reload rather than guessing.
 */
export function EmployerSharing() {
  const { account, dispatch } = useStore();
  const me = account?.id ?? '';
  if (!cloudConfigured) {
    return (
      <>
        <SectionLabel>Share evidence with an employer</SectionLabel>
        <Notice>This copy of Semester is not connected to a school’s Semester service, so nothing can be shared with an employer from it.</Notice>
      </>
    );
  }
  if (!me) {
    return (
      <>
        <SectionLabel>Share evidence with an employer</SectionLabel>
        <PermissionState
          title="Sign in to share evidence with an employer"
          body="What you share comes from documents kept under your Semester account, so it needs you signed in."
          owner="you, through your Semester account"
          recover={{ label: 'Open Account', run: () => dispatch({ type: 'go', screen: 'account' }) }}
        />
      </>
    );
  }
  return <Signed openDocuments={() => goMine(dispatch, 'documents')} />;
}

function Signed({ openDocuments }: { openDocuments: () => void }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [loaded, setLoaded] = useState<Portfolio | null | Error>(null);
  const [reads, setReads] = useState(0);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const [stale, setStale] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Evidence | null>(null);
  const [ending, setEnding] = useState<EmployerAccess | null>(null);

  useEffect(() => {
    let live = true;
    loadPortfolio().then(
      (p) => { if (live) setLoaded(p); },
      (e: unknown) => { if (live) setLoaded(e instanceof Error ? e : new Error('Could not load your portfolio.')); },
    );
    return () => { live = false; };
  }, [reads]);

  const reload = () => { setStale(false); setSaid(null); setLoaded(null); setReads((n) => n + 1); };

  /** One write through its attempt; a stale revision offers a reload instead of a retry. */
  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<boolean> {
    setBusy(true);
    setSaid(null);
    setStale(false);
    try {
      const v = await attempt(what, run);
      const text = done(v);
      setSaid({ tone: 'ok', text });
      say(text);
      setReads((n) => n + 1);
      return true;
    } catch (e) {
      const text = e instanceof Error ? e.message : 'That was not saved.';
      if (e instanceof ObjectsError && e.kind === 'stale') setStale(true);
      setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void write(what, run, done) });
      return false;
    } finally {
      setBusy(false);
      setWithdrawing(null);
      setEnding(null);
    }
  }

  const head = <SectionLabel>Share evidence with an employer</SectionLabel>;
  if (loaded === null) {
    return (
      <>
        {head}
        <LoadingState what="your portfolio" bars={[40, 96, 96]} />
      </>
    );
  }
  if (loaded instanceof ObjectsError && loaded.kind === 'not-set-up') {
    return (
      <>
        {head}
        <Notice>{loaded.message} Nothing has been shared with anyone.</Notice>
      </>
    );
  }
  if (loaded instanceof Error) {
    return (
      <>
        {head}
        <ErrorState title="Your portfolio did not load" body={`${loaded.message} Nothing you shared has changed.`} recover={{ label: 'Load again', run: reload }} />
      </>
    );
  }

  const p = loaded;
  const now = new Date();
  const labelOf = (id: string) => p.evidence.find((e) => e.id === id)?.label ?? 'A withdrawn item';
  const sharedWith = (e: Evidence) => p.access.filter((a) => a.evidence.includes(e.id));

  return (
    <>
      {head}
      <Sub>
        Choose exact saved versions of your documents as evidence, then share named pieces with one employer account for at most {MAX_SHARE_DAYS} days.
        You can see who can read what, and end it at once. Grades are never part of this.
      </Sub>
      <Result said={said} />
      {stale && (
        <Row>
          <ActionButton tone="primary" style={{ width: 'auto', flex: '1 1 auto' }} onClick={reload}>
            Reload your portfolio
          </ActionButton>
        </Row>
      )}

      <SectionLabel aside={`${p.evidence.length} ${p.evidence.length === 1 ? 'item' : 'items'}`}>Your evidence</SectionLabel>
      <Table
        caption="The saved versions you chose as evidence, with who can read each."
        captionHidden
        compact="stack"
        rows={p.evidence}
        rowKey={(e) => e.id}
        empty={
          <EmptyState
            inline
            title="No evidence yet"
            body="Add a saved version of one of your documents below. Documents are kept in Mine › Documents."
            action={{ label: 'Open Documents', onClick: openDocuments }}
          />
        }
        columns={[
          { id: 'label', header: 'Evidence', rowHeader: true, cell: (e) => <span style={{ overflowWrap: 'anywhere' }}>{e.label}</span> },
          { id: 'doc', header: 'Document', cell: (e) => <span style={{ overflowWrap: 'anywhere' }}>{`${e.title} · version ${e.versionNumber}`}</span> },
          { id: 'saved', header: 'Saved', cell: (e) => formatDate(new Date(e.savedAt)) },
          {
            id: 'who',
            header: 'Who can read it',
            cell: (e) => {
              const w = sharedWith(e);
              return w.length === 0 ? 'Only you' : w.map((a) => a.employerEmail).join(', ');
            },
          },
          {
            id: 'withdraw',
            header: 'Withdraw',
            cell: (e) => (
              <button type="button" className="btn" disabled={busy} aria-label={`Withdraw ${e.label}`} onClick={() => setWithdrawing(e)}>
                Withdraw
              </button>
            ),
          },
        ]}
      />

      <AddEvidence
        busy={busy}
        have={new Set(p.evidence.map((e) => e.version))}
        openDocuments={openDocuments}
        onAdd={(v, label, title) =>
          write(
            `evidence:add:${v.version}:${p.revision}:${label}`,
            (key) => addEvidence(v.version, label, p.revision, key),
            () => `“${label}” — ${title}, version ${v.versionNumber} — is in your portfolio. Nobody can read it until you share it.`,
          )
        }
      />

      <SectionLabel aside={`${p.access.length} ${p.access.length === 1 ? 'employer' : 'employers'}`}>Who can see it now</SectionLabel>
      <Table
        caption="Every employer account that can read some of your evidence now, and until when."
        captionHidden
        compact="stack"
        rows={p.access}
        rowKey={(a) => a.grant}
        empty={<Sub>No employer can see any of your evidence.</Sub>}
        columns={[
          {
            id: 'who',
            header: 'Employer account',
            rowHeader: true,
            cell: (a) => <span style={{ overflowWrap: 'anywhere' }}>{`${a.employerEmail} · for ${a.employerScope}`}</span>,
          },
          { id: 'as', header: 'Knows you as', cell: (a) => <span style={{ overflowWrap: 'anywhere' }}>{a.sharedAs}</span> },
          { id: 'items', header: 'Can read', cell: (a) => <span style={{ overflowWrap: 'anywhere' }}>{a.evidence.map(labelOf).join(', ') || 'Nothing now'}</span> },
          {
            id: 'until',
            header: 'Status',
            cell: (a) =>
              a.employerActive
                ? `Until ${formatDate(new Date(a.expiresAt))}`
                : `Reads nothing: this account no longer acts for ${a.employerScope}. Ends ${formatDate(new Date(a.expiresAt))}.`,
          },
          {
            id: 'end',
            header: 'End',
            cell: (a) => (
              <button type="button" className="btn" disabled={busy} aria-label={`End ${a.employerEmail}’s access`} onClick={() => setEnding(a)}>
                End access
              </button>
            ),
          },
        ]}
      />

      <ShareForm
        busy={busy}
        evidence={p.evidence}
        now={now}
        onShare={(req) =>
          write(
            `evidence:share:${p.revision}:${req.employerEmail}:${req.employerScope}:${req.evidence.join(',')}:${req.expiresAt}:${req.sharedAs}:${req.purpose}`,
            (key) => shareWithEmployer(req, p.revision, key),
            (r) => `${req.employerEmail} can read ${req.evidence.length} ${req.evidence.length === 1 ? 'item' : 'items'} until ${formatDate(new Date(r.expiresAt))}. You can end it at any time.`,
          )
        }
      />

      {withdrawing && (
        <ConfirmDialog
          title={`Withdraw ${withdrawing.label}?`}
          preview={
            <ActionPreview
              subject={`${withdrawing.label} · ${withdrawing.title}, version ${withdrawing.versionNumber}`}
              says={
                sharedWith(withdrawing).length > 0
                  ? `Takes it out of your portfolio. ${sharedWith(withdrawing).map((a) => a.employerEmail).join(', ')} stop seeing it at once.`
                  : 'Takes it out of your portfolio. No employer can see it now.'
              }
              doesNotChange="Your document and the saved version stay exactly as they are. Other evidence, and other shares, are unchanged."
              recovery={{ kind: 'none', how: 'You can add the same version again; it would need sharing again.' }}
            />
          }
          confirmLabel={busy ? 'Withdrawing…' : 'Withdraw'}
          onCancel={() => { if (!busy) setWithdrawing(null); }}
          onConfirm={() => {
            if (busy) return;
            const e = withdrawing;
            void write(`evidence:withdraw:${e.id}:${p.revision}`, (key) => withdrawEvidence(e.id, p.revision, key), () => `“${e.label}” is out of your portfolio. No employer can read it now.`);
          }}
        />
      )}

      {ending && (
        <ConfirmDialog
          title="End this employer’s access?"
          preview={
            <ActionPreview
              subject={`${ending.employerEmail} · for ${ending.employerScope}`}
              says={`${ending.employerEmail} can no longer read ${ending.evidence.map(labelOf).join(', ') || 'anything you shared'}, from the moment you confirm.`}
              doesNotChange="Your evidence stays in your portfolio, and other employers’ access is unchanged. Anything they already read is not taken back."
              recovery={{ kind: 'none', how: 'You can share with them again; that makes a new share.' }}
            />
          }
          confirmLabel={busy ? 'Ending…' : 'End access'}
          onCancel={() => { if (!busy) setEnding(null); }}
          onConfirm={() => {
            if (busy) return;
            const a = ending;
            void write(
              `evidence:revoke:${a.grant}:${p.revision}`,
              (key) => revokeEmployer(a.grant, p.revision, key),
              (r) => `${a.employerEmail}’s access ended at ${formatDateTime(new Date(r.revokedAt))}.`,
            );
          }}
        />
      )}
    </>
  );
}

/** Picking a document, one of its saved versions, and a label. */
function AddEvidence({
  busy,
  have,
  openDocuments,
  onAdd,
}: {
  busy: boolean;
  have: ReadonlySet<string>;
  openDocuments: () => void;
  onAdd: (v: VersionEntry, label: string, title: string) => Promise<boolean>;
}) {
  const [docs, setDocs] = useState<WorkspaceObject[] | null | Error>(null);
  const [doc, setDoc] = useState('');
  /** The versions of `of`; while `of` is not the chosen document they are still loading. */
  const [listed, setListed] = useState<{ of: string; got: VersionEntry[] | Error } | null>(null);
  const [version, setVersion] = useState('');
  const [label, setLabel] = useState('');

  const loadDocs = useCallback(() => {
    listMine().then(
      (d) => { setDocs(d); setDoc((cur) => cur || d[0]?.id || ''); },
      (e: unknown) => setDocs(e instanceof Error ? e : new Error('Could not load your documents.')),
    );
  }, []);
  useEffect(loadDocs, [loadDocs]);

  useEffect(() => {
    if (!doc) return;
    let live = true;
    listVersions(doc).then(
      (v) => { if (live) { setListed({ of: doc, got: v }); setVersion(v[0]?.version ?? ''); } },
      (e: unknown) => { if (live) setListed({ of: doc, got: e instanceof Error ? e : new Error('Could not load its versions.') }); },
    );
    return () => { live = false; };
  }, [doc]);
  const versions = listed && listed.of === doc ? listed.got : null;

  const head = <SectionLabel>Add evidence</SectionLabel>;
  if (docs === null) {
    return (
      <>
        {head}
        <LoadingState what="your documents" bars={[40]} />
      </>
    );
  }
  if (docs instanceof Error) {
    return (
      <>
        {head}
        <ErrorState title="Your documents did not load" body={docs.message} recover={{ label: 'Load again', run: () => { setDocs(null); loadDocs(); } }} />
      </>
    );
  }
  if (docs.length === 0) {
    return (
      <>
        {head}
        <EmptyState
          inline
          title="No documents to choose from"
          body="Evidence is a saved version of a document kept in Semester. Make one in Mine › Documents, then come back."
          action={{ label: 'Open Documents', onClick: openDocuments }}
        />
      </>
    );
  }

  const chosenDoc = docs.find((d) => d.id === doc) ?? null;
  const v = Array.isArray(versions) ? versions.find((x) => x.version === version) ?? null : null;
  const trimmed = label.trim();
  const problem =
    !v ? 'Choose a saved version.' : have.has(v.version) ? 'That version is already in your portfolio.' : trimmed === '' || trimmed.length > 120 ? 'Name the evidence in up to 120 characters.' : null;

  return (
    <>
      {head}
      <Stack label="Add evidence">
        <Field label="Document">
          {(ids) => (
            <select id={ids.id} className="input" value={doc} onChange={(e) => setDoc(e.target.value)}>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Saved version" hint="Evidence is this exact version. Saving the document again later does not change it.">
          {(ids) =>
            versions === null ? (
              <p id={ids.id} role="status">
                Loading its versions…
              </p>
            ) : versions instanceof Error ? (
              <p id={ids.id} role="alert">
                {versions.message}
              </p>
            ) : (
              <select id={ids.id} aria-describedby={ids.hint} className="input" value={version} onChange={(e) => setVersion(e.target.value)}>
                {versions.map((x) => (
                  <option key={x.version} value={x.version}>
                    Version {x.versionNumber} · {formatDate(new Date(x.savedAt))}
                    {have.has(x.version) ? ' · already evidence' : ''}
                  </option>
                ))}
              </select>
            )
          }
        </Field>
        <Field label="Label" hint="What an employer sees it called, up to 120 characters — for example “Capstone report, data analysis”.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />}
        </Field>
        <div role="status">{label !== '' && problem && <Sub>{problem}</Sub>}</div>
        <Row>
          <ActionButton
            tone="primary"
            disabled={busy || problem !== null}
            style={{ width: 'auto', flex: '1 1 auto' }}
            onClick={() => {
              if (!v || !chosenDoc) return;
              void onAdd(v, trimmed, chosenDoc.title).then((ok) => { if (ok) setLabel(''); });
            }}
          >
            Add to portfolio
          </ActionButton>
        </Row>
      </Stack>
    </>
  );
}

/** Sharing named evidence with one employer account until a date. */
function ShareForm({
  busy,
  evidence,
  now,
  onShare,
}: {
  busy: boolean;
  evidence: readonly Evidence[];
  now: Date;
  onShare: (req: { employerEmail: string; employerScope: string; evidence: string[]; sharedAs: string; purpose: string; expiresAt: string }) => Promise<boolean>;
}) {
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [sharedAs, setSharedAs] = useState('');
  const [purpose, setPurpose] = useState('');
  const [ends, setEnds] = useState('');
  const [touched, setTouched] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  if (evidence.length === 0) return null;

  const chosen = evidence.filter((e) => picked[e.id]).map((e) => e.id);
  const tomorrow = dateToIso(new Date(now.getTime() + 86_400_000));
  // The last whole day inside the limit: the server counts 180 days from the moment it is shared.
  const last = dateToIso(new Date(now.getTime() + (MAX_SHARE_DAYS - 1) * 86_400_000));
  const req = {
    employerEmail: email.trim(),
    employerScope: scope.trim(),
    evidence: chosen,
    sharedAs: sharedAs.trim(),
    purpose: purpose.trim(),
    expiresAt: ends ? endOfDay(ends) : '',
  };
  const problem = shareProblem(req, now);

  return (
    <>
      <SectionLabel>Share with an employer</SectionLabel>
      <Stack label="Share with an employer">
        <Sub>
          The employer must have a Semester account that acts for them. They read only the items you tick, only until the end date, and every read
          is recorded.
        </Sub>
        <Field label="Employer’s email address" hint="The address of their Semester account.">
          {(ids) => (
            <input id={ids.id} aria-describedby={ids.hint} className="input" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
          )}
        </Field>
        <Field label="Employer" hint="As Semester names them — the employer can tell you. Up to 200 characters.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" maxLength={200} value={scope} onChange={(e) => setScope(e.target.value)} />}
        </Field>
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend>Evidence to share (at most {MAX_SHARE_ITEMS})</legend>
          {evidence.map((e) => (
            <label key={e.id} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'start', minHeight: 'var(--target-primary)', paddingBlock: 'var(--sp-2)', overflowWrap: 'anywhere' }}>
              <input type="checkbox" checked={!!picked[e.id]} onChange={(x) => setPicked({ ...picked, [e.id]: x.target.checked })} />
              <span>
                {e.label} <Sub>{`${e.title} · version ${e.versionNumber}`}</Sub>
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="How they should know you" hint="Up to 80 characters — for example your name as on your application.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" maxLength={80} value={sharedAs} onChange={(e) => setSharedAs(e.target.value)} />}
        </Field>
        <Field label="What it is shared for" hint="Up to 200 characters. The employer sees this.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" maxLength={200} value={purpose} onChange={(e) => setPurpose(e.target.value)} />}
        </Field>
        <DateField label="Ends on" value={ends} onChange={setEnds} min={tomorrow} max={last} required hint={`Within ${MAX_SHARE_DAYS} days. Access ends at the end of that day, or sooner if you end it.`} />
        <div role="status">{(touched || chosen.length > 0) && problem && <Sub>{problem}</Sub>}</div>
        <Row>
          <ActionButton tone="primary" disabled={busy || problem !== null} style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => setReviewing(true)}>
            Review and share
          </ActionButton>
        </Row>
      </Stack>

      {reviewing && (
        <ConfirmDialog
          title={`Share with ${req.employerEmail}?`}
          preview={
            <ActionPreview
              subject={`${req.employerEmail} · for ${req.employerScope}`}
              says={`They can read ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} until the end of ${formatDate(new Date(`${ends}T12:00:00`))}, and know you as “${req.sharedAs}”.`}
              exactly={evidence
                .filter((e) => picked[e.id])
                .map((e) => `${e.label} (${e.title}, version ${e.versionNumber})`)
                .join('; ')}
              doesNotChange="Your documents, your other evidence and your grades are not shared. Saving a document again does not change what they read."
              recovery={{ kind: 'undo', how: 'End their access from “Who can see it now” at any time; it ends at once.' }}
            />
          }
          confirmLabel={busy ? 'Sharing…' : 'Share'}
          onCancel={() => { if (!busy) setReviewing(false); }}
          onConfirm={() => {
            if (busy) return;
            void onShare(req).then((ok) => {
              setReviewing(false);
              if (ok) {
                setPicked({});
                setPurpose('');
                setEnds('');
              }
            });
          }}
        />
      )}
    </>
  );
}
