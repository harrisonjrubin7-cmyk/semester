import { useEffect, useRef, useState } from 'react';
import { ActionButton, Notice, SectionLabel } from './ui';
import { ConfirmDialog } from './ConfirmDialog';
import { ActionPreview } from './unity/ActionPreview';
import { FieldMessage, useFieldErrors } from './FieldMessage';
import { useStore } from '../state/store';
import {
  autoClaimDeclined,
  claimSchool,
  claimedSchoolOrUnknown,
  decideRequest,
  knownSchools,
  leaveSchool,
  looksClaimable,
  myRequests,
  readinessOf,
  rememberDeclined,
  requestMembership,
  schoolEnforced,
  shouldAutoClaim,
  waitingFor,
  withdrawRequest,
  type Claim,
  type KnownSchool,
  type MyRequest,
  type Readiness,
  type WaitingRequest,
} from '../lib/schoolclaim';

/**
 * Telling the server which university you are at, rather than telling yourself.
 *
 * `profiles.school_id` is what the *server* believes, and the only ways to set
 * it are `claim_school()` (which reads the address the account service
 * confirmed), a person at the school approving a request, or — for the same
 * effect the other way — leaving. Nothing on this screen can admit anybody: if
 * this file returned success to everything, no row would change.
 *
 * ## What it is worth
 *
 * A school's course rooms are open to anyone until Semester switches that
 * school to members-only (`schools.enforce_membership`, off for every school
 * that exists). Once it is on, only accounts that have proved they are at that
 * school can join, read or post in its rooms. This screen says which of the two
 * is true for *your* school, so the claim is never presented as a protection
 * that is not switched on.
 *
 * ## The three ways in
 *
 * 1. **Your address is one the school publishes, and only one school publishes
 *    it:** claimed for you, once, and said in a sentence with a way to undo it.
 *    If you leave, it is not done for you again on this device.
 * 2. **Your address matches more than one school, or you want to claim by
 *    choice:** the Claim button, which the server checks against the address it
 *    confirmed.
 * 3. **Your address is not any school's** (a personal address, a visiting
 *    student): "Ask to join" sends a short note to that school's
 *    administrators. It grants nothing until one of them approves.
 *
 * The API is a prop so a test can drive every branch without a server.
 */
export interface SchoolApi {
  knownSchools: () => Promise<KnownSchool[]>;
  /** `null` when the read failed: never treated as "at no university". */
  claimedSchool: () => Promise<string | null>;
  claimSchool: (id: string) => Promise<Claim>;
  requestMembership: (id: string, why: string) => Promise<{ ok: true } | { ok: false; because: string }>;
  withdrawRequest: (id: string) => Promise<{ ok: true } | { ok: false; because: string }>;
  leaveSchool: () => Promise<{ ok: true } | { ok: false; because: string }>;
  decideRequest: (id: string, approve: boolean) => Promise<{ ok: true } | { ok: false; because: string }>;
  /** `null` when it could not be checked. */
  schoolEnforced: (id: string) => Promise<boolean | null>;
  myRequests: (userId: string) => Promise<MyRequest[]>;
  waitingFor: (id: string) => Promise<WaitingRequest[]>;
  readinessOf: (id: string) => Promise<Readiness | null>;
}

const REAL: SchoolApi = {
  knownSchools, claimedSchool: claimedSchoolOrUnknown, claimSchool, requestMembership, withdrawRequest,
  leaveSchool, decideRequest, schoolEnforced, myRequests, waitingFor, readinessOf,
};

type Confirming = { kind: 'leave' } | { kind: 'approve'; request: WaitingRequest } | null;

export function SchoolClaim({
  api = REAL,
  who,
}: {
  api?: SchoolApi;
  /** The signed-in account, for a test that has none. */
  who?: { id: string; email: string };
} = {}) {
  const store = useStore();
  const account = who ?? store.account;
  const fields = useFieldErrors(['note'] as const);

  /** `null` while the first read is in flight, so "none" is never shown early. */
  const [schools, setSchools] = useState<KnownSchool[] | null>(null);
  const [claimed, setClaimed] = useState('');
  const [enforced, setEnforced] = useState<boolean | null>(false);
  const [unknownMembership, setUnknownMembership] = useState(false);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [waiting, setWaiting] = useState<WaitingRequest[]>([]);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [refused, setRefused] = useState('');
  const [said, setSaid] = useState('');
  const [confirming, setConfirming] = useState<Confirming>(null);
  const triedAuto = useRef(false);
  const accountId = account?.id ?? '';
  const address = account?.email ?? '';

  const refresh = async () => {
    const [known, read] = await Promise.all([api.knownSchools(), api.claimedSchool()]);
    // null: the server could not be asked. Nothing below may treat that as
    // "at no university", or a failed read would let the automatic claim move
    // someone who is already somewhere.
    const already = read ?? '';
    setUnknownMembership(read === null);
    setSchools(known);
    setClaimed(already);
    const [flag, requests, list, counts] = await Promise.all([
      already ? api.schoolEnforced(already) : Promise.resolve(false),
      accountId ? api.myRequests(accountId) : Promise.resolve([]),
      already ? api.waitingFor(already) : Promise.resolve([]),
      already ? api.readinessOf(already) : Promise.resolve(null),
    ]);
    setEnforced(flag);
    setMine(requests);
    setWaiting(list);
    setReady(counts);
    return { known, already, unknown: read === null };
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { known, already, unknown } = await refresh();
      if (!alive || triedAuto.current) return;
      if (unknown) return; // could not read the claim: change nothing, offer a retry below
      triedAuto.current = true;
      const auto = shouldAutoClaim(address, known, already, accountId ? autoClaimDeclined(accountId) : true);
      if (!auto) return;
      const result = await api.claimSchool(auto.id);
      if (!alive) return;
      if (result.ok) {
        setSaid(`You are now at ${auto.name}, because your address is one it publishes. You can leave at any time.`);
        await refresh();
      }
      // A refusal here is silent on purpose: it was not asked for, and the
      // explicit list below is still there.
    })();
    return () => {
      alive = false;
    };
    // The API and account are stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = async (school: KnownSchool) => {
    setBusy(school.id);
    setRefused('');
    const result = await api.claimSchool(school.id);
    // Read the column back rather than trusting the return: this column's
    // whole value is that it cannot be bluffed.
    if (result.ok) {
      if (accountId) rememberDeclined(accountId, false);
      await refresh();
    } else setRefused(result.because);
    setBusy('');
  };

  const ask = async (school: KnownSchool) => {
    if (!fields.check({ note: note.trim().length >= 3 ? '' : 'Say a few words so their staff can recognise you, for example a course you take.' })) return;
    setBusy(school.id);
    setRefused('');
    setSaid('');
    const result = await api.requestMembership(school.id, note.trim());
    if (result.ok) {
      setNote('');
      setSaid(`Your request to join ${school.name} is waiting for its staff. Nothing changes until they approve it.`);
      await refresh();
    } else setRefused(result.because);
    setBusy('');
  };

  const withdraw = async (request: MyRequest) => {
    setBusy(request.id);
    const result = await api.withdrawRequest(request.id);
    if (!result.ok) setRefused(result.because);
    await refresh();
    setBusy('');
  };

  const leave = async () => {
    setConfirming(null);
    setBusy('leave');
    setRefused('');
    const result = await api.leaveSchool();
    if (result.ok) {
      if (accountId) rememberDeclined(accountId, true);
      setSaid('You have left. Nothing you made was deleted.');
      await refresh();
    } else setRefused(result.because);
    setBusy('');
  };

  const decide = async (request: WaitingRequest, approve: boolean) => {
    setConfirming(null);
    setBusy(request.id);
    setRefused('');
    const result = await api.decideRequest(request.id, approve);
    if (!result.ok) setRefused(result.because);
    await refresh();
    setBusy('');
  };

  const school = schools?.find((s) => s.id === claimed) ?? null;
  const waitingMine = mine.filter((r) => r.status === 'pending');
  const nameOf = (id: string) => schools?.find((s) => s.id === id)?.name ?? id;

  return (
    <section>
      <SectionLabel>Your university</SectionLabel>

      {said && <Notice>{said}</Notice>}
      {refused && <Notice alert>{refused}</Notice>}

      {unknownMembership ? (
        <>
          <Notice alert>
            We could not check which university you are at just now, so nothing has been changed. Try again in a moment.
          </Notice>
          <ActionButton onClick={() => void refresh()} disabled={busy !== ''}>
            Try again
          </ActionButton>
        </>
      ) : claimed ? (
        <>
          <Notice>
            The server has you at <strong>{school ? school.name : claimed}</strong>.{' '}
            {enforced === null
              ? 'We could not check just now whether its course rooms are limited to members, so this page does not say either way.'
              : enforced
                ? 'Its course rooms are open only to people who have proved they are here, and you have.'
                : 'Its course rooms are not limited to members yet, so this changes nothing you can see today. It is what will keep you in, and others out, when they are.'}
          </Notice>
          <ActionButton onClick={() => setConfirming({ kind: 'leave' })} disabled={busy !== ''}>
            Leave this university
          </ActionButton>

          {ready && (
            <div style={{ marginBlockStart: 'var(--sp-5)' }}>
              <SectionLabel>For this university's staff</SectionLabel>
              <Notice>
                {ready.members} {ready.members === 1 ? 'person has' : 'people have'} proved they are here.{' '}
                {ready.enrolled} {ready.enrolled === 1 ? 'is' : 'are'} in its course rooms; if the rooms were limited to
                members, {ready.lockedOut} would lose access until they claimed or were approved.{' '}
                Members-only is {ready.enforced ? 'on' : 'off'}; Semester staff switch it, once this number is agreed.
              </Notice>
              {waiting.length === 0 ? (
                <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>Nobody is waiting to join.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {waiting.map((request) => (
                    <li key={request.id} style={{ marginBlockEnd: 'var(--sp-4)' }}>
                      <div style={{ fontSize: 'var(--type-base)' }}>
                        <strong>{request.handle}</strong> asks to join
                      </div>
                      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-normal)' }}>
                        “{request.note}”
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBlockStart: 'var(--sp-3)' }}>
                        <ActionButton disabled={busy !== ''} onClick={() => setConfirming({ kind: 'approve', request })}>
                          Approve {request.handle}
                        </ActionButton>
                        <ActionButton disabled={busy !== ''} onClick={() => void decide(request, false)}>
                          Decline {request.handle}
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : schools === null ? (
        <Notice>Checking…</Notice>
      ) : schools.length === 0 ? (
        <Notice>
          No universities are set up on this server yet, so there is nothing to claim. This is added by an
          administrator rather than in the app, and the list appears here on its own once one exists.
        </Notice>
      ) : (
        <>
          <Notice>
            Claiming proves to the server which university you are at, using the address it already confirmed — not the
            one typed anywhere. It changes nothing you can see today: a university&rsquo;s course rooms are limited to
            its members only once it is switched on for that university. If your address is not any university&rsquo;s,
            ask to join: their staff decide, and nothing changes until they do.
          </Notice>

          {waitingMine.map((request) => (
            <div key={request.id} style={{ marginBlockEnd: 'var(--sp-3)' }}>
              <span style={{ fontSize: 'var(--type-base)' }}>
                Waiting for {nameOf(request.schoolId)} to answer your request.
              </span>{' '}
              <ActionButton disabled={busy !== ''} onClick={() => void withdraw(request)}>
                Withdraw request to {nameOf(request.schoolId)}
              </ActionButton>
            </div>
          ))}

          <label htmlFor={fields.control('note').id} style={{ display: 'block', marginBlockEnd: 'var(--sp-2)' }}>
            How can their staff recognise you? (for “Ask to join”)
          </label>
          <input
            {...fields.control('note')}
            aria-label="How can their staff recognise you"
            className="input"
            maxLength={300}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              fields.clear('note');
            }}
          />
          <FieldMessage {...fields.message('note')} />

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {schools.map((s) => {
              const fits = address !== '' && looksClaimable(address, s);
              return (
                <li key={s.id} style={{ marginBlockEnd: 'var(--sp-4)' }}>
                  <div style={{ fontSize: 'var(--type-base)' }}>{s.name}</div>
                  <div
                    style={{
                      fontSize: 'var(--type-sm)',
                      color: 'var(--app-dim)',
                      lineHeight: 'var(--leading-normal)',
                      marginBlockStart: 'var(--sp-2)',
                    }}
                  >
                    {s.domains.length === 0
                      ? 'This one publishes no addresses yet, so nobody can claim it; you can still ask to join.'
                      : fits
                        ? `Your address is one ${s.shortName || s.name} publishes.`
                        : `Claimable with an address ending ${s.domains.map((d) => `@${d}`).join(' or ')}.`}
                  </div>
                  {fits ? (
                    <ActionButton onClick={() => void claim(s)} disabled={busy !== ''} style={{ marginBlockStart: 'var(--sp-3)' }}>
                      {busy === s.id ? 'Claiming…' : `Claim ${s.shortName || s.name}`}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      onClick={() => void ask(s)}
                      disabled={busy !== '' || waitingMine.some((r) => r.schoolId === s.id)}
                      style={{ marginBlockStart: 'var(--sp-3)' }}
                    >
                      {busy === s.id ? 'Sending…' : `Ask to join ${s.shortName || s.name}`}
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {confirming?.kind === 'leave' && (
        <ConfirmDialog
          title="Leave this university?"
          preview={
            <ActionPreview
              subject={school ? school.name : 'This university'}
              says="You will no longer be recorded as being here. If its course rooms are members-only, you lose access until you claim again or are approved."
              doesNotChange="Nothing you made is deleted."
              recovery={{
                kind: 'undo',
                how: 'Claim this university again from this screen. We will not claim it for you on this device.',
              }}
            />
          }
          confirmLabel="Leave"
          onConfirm={() => void leave()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming?.kind === 'approve' && (
        <ConfirmDialog
          title={`Approve ${confirming.request.handle}?`}
          preview={
            <ActionPreview
              subject={confirming.request.handle}
              says={`They will be recorded as being at ${school ? school.name : 'this university'}, and can join its course rooms if those are members-only.`}
              exactly={confirming.request.note ? `They wrote: “${confirming.request.note}”.` : undefined}
              recovery={{ kind: 'undo', how: 'You can remove them later from this screen.' }}
            />
          }
          confirmLabel="Approve"
          onConfirm={() => void decide(confirming.request, true)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
