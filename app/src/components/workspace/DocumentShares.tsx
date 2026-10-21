import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { DateField } from '../unity/DateField';
import { ErrorState, LoadingState } from '../unity/States';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, fieldProps } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { dateToIso } from '../../lib/date';
import { formatDate, formatDateTime } from '../../lib/locale';
import {
  ACCOUNT_ID,
  listShares,
  revoke,
  share,
  shareLive,
  type Permission,
  type ShareEntry,
  type VersionEntry,
} from '../../lib/workspace/objects';

/** What each permission lets the other person do, in words. */
export const CAN: Record<Permission, string> = {
  read: 'Read',
  comment: 'Read and comment',
  edit: 'Read and save new versions',
};

/** The end of the chosen day, on this device's clock, as the server wants it. */
export const endOfDay = (iso: string): string => new Date(`${iso}T23:59:59`).toISOString();

/** Why this share cannot be sent yet, or null. The server checks all of it again. */
export function sharingProblem(
  req: { grantee: string; permission: Permission; pinned: boolean; purpose: string; ends: string },
  me: string,
  now: Date = new Date(),
): string | null {
  const who = req.grantee.trim();
  if (who === '') return 'Enter the account id of the person to share with.';
  if (!ACCOUNT_ID.test(who)) return 'That is not an account id. One is 36 characters in five groups, like 3f2a9c1e-0b7d-4c55-9a10-6e2f8b3d4c21.';
  if (who.toLowerCase() === me.toLowerCase()) return 'That is your own account. You already have this document.';
  if (req.pinned && req.permission === 'edit') return 'A saved version never changes, so it can be shared to read or comment only.';
  const why = req.purpose.trim();
  if (why === '' || why.length > 200) return 'Say in up to 200 characters what it is shared for.';
  if (req.ends !== '' && Date.parse(endOfDay(req.ends)) <= now.getTime()) return 'Choose an end date that has not passed.';
  return null;
}

/**
 * Who a document is shared with, and sharing it with one more person.
 *
 * A share names one account and either the live document — it follows every
 * new version — or one saved version and nothing else, for good. Editing is
 * only offered on the live document, because a saved version never changes.
 * Sharing and stopping a share are both previewed first (`ConfirmDialog` with
 * `ActionPreview`) and go through `useAttempts`, so a lost answer is retried
 * with the same key and cannot share twice.
 */
export function DocumentShares({ objectId, me, title, versions }: { objectId: string; me: string; title: string; versions: readonly VersionEntry[] }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [shares, setShares] = useState<ShareEntry[] | null | Error>(null);
  const [grantee, setGrantee] = useState('');
  const [target, setTarget] = useState('live');
  const [permission, setPermission] = useState<Permission>('read');
  const [purpose, setPurpose] = useState('');
  const [ends, setEnds] = useState('');
  const [left, setLeft] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [stopping, setStopping] = useState<ShareEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);

  const load = useCallback(() => {
    listShares(objectId).then(setShares, (e: unknown) => setShares(e instanceof Error ? e : new Error('Could not load who it is shared with.')));
  }, [objectId]);
  useEffect(load, [load]);

  const pinned = target !== 'live';
  const version = versions.find((v) => v.version === target) ?? null;
  const problem = sharingProblem({ grantee, permission, pinned, purpose, ends }, me);
  const granteeProblem = left && grantee.trim() !== '' && problem && /account/.test(problem) ? problem : undefined;
  const what = (s: { version: string | null }) => {
    if (s.version === null) return 'The live document';
    const v = versions.find((x) => x.version === s.version);
    return v ? `Version ${v.versionNumber} only` : 'One saved version only';
  };
  const subject = pinned && version ? `${title} · version ${version.versionNumber} only` : `${title} · the live document`;
  const now = new Date();
  const tomorrow = dateToIso(new Date(now.getTime() + 86_400_000));

  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<void> {
    setBusy(true);
    setSaid(null);
    try {
      const v = await attempt(what, run);
      const text = done(v);
      setSaid({ tone: 'ok', text });
      say(text);
      load();
    } catch (e) {
      const text = e instanceof Error ? e.message : 'That was not saved.';
      setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void write(what, run, done) });
    } finally {
      setBusy(false);
      setReviewing(false);
      setStopping(null);
    }
  }

  const send = () => {
    const req = {
      objectId,
      versionId: pinned ? target : null,
      grantee: grantee.trim(),
      permission,
      purpose: purpose.trim(),
      expiresAt: ends === '' ? null : endOfDay(ends),
    };
    void write(
      `share:${objectId}:${req.versionId ?? 'live'}:${req.grantee}:${permission}:${req.expiresAt ?? 'open'}:${req.purpose}`,
      (key) => share(req, key),
      (r) => {
        setGrantee('');
        setPurpose('');
        setEnds('');
        setLeft(false);
        return `Shared with ${req.grantee}: ${CAN[r.permission].toLowerCase()}${r.expiresAt ? ` until ${formatDate(new Date(r.expiresAt))}` : ' until you stop it'}.`;
      },
    );
  };

  const stop = (s: ShareEntry) =>
    void write(
      `revoke:${s.grant}`,
      () => revoke(s.grant),
      (r) => `Stopped sharing with ${s.grantee} at ${formatDateTime(new Date(r.revokedAt))}. They can no longer open it.`,
    );

  const status = (s: ShareEntry): string => {
    if (s.revokedAt) return `Stopped ${formatDate(new Date(s.revokedAt))}`;
    if (!shareLive(s, now)) return `Ended ${formatDate(new Date(s.expiresAt ?? s.grantedAt))}`;
    return s.expiresAt ? `Active until ${formatDate(new Date(s.expiresAt))}` : 'Active until you stop it';
  };

  return (
    <>
      <SectionLabel aside={Array.isArray(shares) ? `${shares.filter((s) => shareLive(s, now)).length} active` : undefined}>Shared with</SectionLabel>
      <Result said={said} />
      {shares === null ? (
        <LoadingState what="who it is shared with" bars={[40]} />
      ) : shares instanceof Error ? (
        <ErrorState title="Who it is shared with did not load" body={shares.message} recover={{ label: 'Load again', run: load }} />
      ) : (
        <Table
          caption={`Everyone ${title} has been shared with, newest first, including shares that ended.`}
          captionHidden
          compact="stack"
          rows={shares}
          rowKey={(s) => s.grant}
          empty={<Sub>Only you can open this document. Share it below to let one other account read, comment on or edit it.</Sub>}
          columns={[
            { id: 'who', header: 'Account', rowHeader: true, cell: (s) => <code style={{ overflowWrap: 'anywhere' }}>{s.grantee}</code> },
            { id: 'what', header: 'What', cell: what },
            { id: 'can', header: 'Can', cell: (s) => CAN[s.permission] },
            { id: 'purpose', header: 'For', cell: (s) => <span style={{ overflowWrap: 'anywhere' }}>{s.purpose}</span> },
            { id: 'status', header: 'Status', cell: status },
            {
              id: 'stop',
              header: 'Stop',
              cell: (s) =>
                shareLive(s, now) ? (
                  <button type="button" className="btn" aria-label={`Stop sharing with ${s.grantee}`} disabled={busy} onClick={() => setStopping(s)}>
                    Stop sharing
                  </button>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      )}

      <Stack label="Share with one more person">
        <Sub>
          Share with one account at a time. Nobody gets access by school, email domain or link — only the account you name here.
        </Sub>
        <Field label="Their account id" hint="Ask them for it: it is shown under Documents in their Mine tab. Semester does not look people up by name or email for this.">
          {(ids) => (
            <>
              <input
                className="input"
                {...fieldProps(ids.id, granteeProblem, ids.hint)}
                id={ids.id}
                value={grantee}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setGrantee(e.target.value)}
                onBlur={() => setLeft(true)}
              />
              <FieldMessage id={ids.id} error={granteeProblem} />
            </>
          )}
        </Field>
        <Field label="What to share" hint="A saved version stays exactly as it is; the live document follows every new version you save.">
          {(ids) => (
            <select
              id={ids.id}
              aria-describedby={ids.hint}
              className="input"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                if (e.target.value !== 'live' && permission === 'edit') setPermission('read');
              }}
            >
              <option value="live">The live document</option>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  Version {v.versionNumber} only
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="They can" hint={pinned ? 'A saved version never changes, so it can be shared to read or comment only.' : undefined}>
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={permission} onChange={(e) => setPermission(e.target.value as Permission)}>
              <option value="read">{CAN.read}</option>
              <option value="comment">{CAN.comment}</option>
              <option value="edit" disabled={pinned}>
                {CAN.edit}
              </option>
            </select>
          )}
        </Field>
        <Field label="What it is shared for" hint="Up to 200 characters. They do not see this; it is your record of why.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" maxLength={200} value={purpose} onChange={(e) => setPurpose(e.target.value)} />}
        </Field>
        <DateField label="Ends on (optional)" value={ends} onChange={setEnds} min={tomorrow} hint="Leave it empty to share until you stop it. Access ends at the end of that day." />
        <div role="status">{(left || purpose !== '') && problem && !granteeProblem && <Sub>{problem}</Sub>}</div>
        <Row>
          <ActionButton tone="primary" disabled={busy || problem !== null} style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => setReviewing(true)}>
            Review and share
          </ActionButton>
        </Row>
      </Stack>

      {reviewing && (
        <ConfirmDialog
          title={`Share ${title}?`}
          preview={
            <ActionPreview
              subject={subject}
              says={`Account ${grantee.trim()} can ${CAN[permission].toLowerCase()} ${pinned && version ? `version ${version.versionNumber} and nothing else` : 'the live document, including versions you save later'}${ends ? `, until the end of ${formatDate(new Date(`${ends}T12:00:00`))}` : ', until you stop it'}.`}
              exactly={purpose.trim() ? `Shared for: “${purpose.trim()}”` : undefined}
              doesNotChange="Your document and every version of it stay exactly as they are. Nobody else gets access, and they cannot share it onward."
              recovery={{ kind: 'undo', how: 'Stop sharing from this list at any time; it ends at once.' }}
            />
          }
          confirmLabel={busy ? 'Sharing…' : 'Share'}
          onCancel={() => { if (!busy) setReviewing(false); }}
          onConfirm={() => { if (!busy) send(); }}
        />
      )}

      {stopping && (
        <ConfirmDialog
          title="Stop sharing?"
          preview={
            <ActionPreview
              subject={`${title} · ${stopping.grantee}`}
              says={`Account ${stopping.grantee} can no longer open ${what(stopping).toLowerCase()}, from the moment you confirm.`}
              doesNotChange="Your document and its versions are unchanged. Anything they already read or copied is not taken back."
              recovery={{ kind: 'none', how: 'You can share with them again; that makes a new share.' }}
            />
          }
          confirmLabel={busy ? 'Stopping…' : 'Stop sharing'}
          onCancel={() => { if (!busy) setStopping(null); }}
          onConfirm={() => { if (!busy) stop(stopping); }}
        />
      )}
    </>
  );
}
