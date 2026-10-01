import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { formatDateTime } from '../../lib/locale';
import {
  admissionsCapabilities, closeCycle, decideApplication, loadCycles, loadMyApplications, loadOfficeApplications, loadYield, markDocument,
  missingAnswers, missingDocuments, openCycle, parseChecklist, parseQuestions, recordDeposit, releaseDecisions, respondToOffer, reviewApplication,
  saveAnswers, saveCycle, startApplication, submitApplication, withdrawApplication,
  type AdmissionsCapability, type Cycle, type MyApplication, type OfficeApplication, type Yield,
} from '../../lib/admissions/client';
import { ActionButton, EmptyState, Notice, SectionLabel, TabList } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
type View = 'apply' | 'office';

/**
 * Admissions, for a school that runs it in Core: your own application, and the
 * admissions office. In Connect it says the school’s own system holds
 * admissions and stops. Whether you are admitted is a person’s decision, made
 * by someone other than the reviewer and shown to you only when the school
 * releases it (`20261001060000_admissions.sql`). Nothing here scores or ranks.
 */
export function AdmissionsHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [view, setView] = useState<View>('apply');

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me) return <Notice>Sign in to apply or to work in the admissions office. It is the school’s record, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs admissions in Semester…</p>;
  const mode = school.id ? resolveModuleMode('admissions', rows) : null;
  if (mode && mode.mode !== 'core') {
    return <Notice>Your school’s own system holds admissions. Semester shows applications here only when your school switches admissions to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read your roles at this school. Nothing has changed. Try again in a moment.</Notice>;
  const held = admissionsCapabilities(grants, school.id);
  const showing: View = held.size > 0 ? view : 'apply';
  return (
    <>
      {held.size > 0 && <TabList label="Admissions views" value={showing} onChange={setView} tabs={[{ id: 'apply', label: 'Your application' }, { id: 'office', label: 'Admissions office' }]} />}
      {showing === 'apply' ? <MyApplications me={me} /> : <Office school={school.id} me={me} held={held} />}
    </>
  );
}

function useWrite(): { said: Said | null; busy: boolean; write: <T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string) => Promise<boolean> } {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<boolean> {
    setBusy(true); setSaid(null);
    try {
      const v = await attempt(what, run);
      const t = done(v);
      setSaid({ tone: 'ok', text: t }); say(t);
      return true;
    } catch (e) {
      const t = e instanceof Error ? e.message : 'That was not saved.';
      setSaid(e instanceof ServiceError && !e.answered ? { tone: 'unknown', text: t, retry: () => void write(what, run, done) } : { tone: 'refused', text: t });
      return false;
    } finally { setBusy(false); }
  }
  return { said, busy, write };
}

const DECISION_WORDS = { admit: 'You are offered admission.', deny: 'The school is not able to offer you admission.', waitlist: 'You are on the waitlist.' } as const;

function MyApplications({ me }: { me: string }): ReactNode {
  const [list, setList] = useState<MyApplication[] | string | null>(null);
  const [reads, setReads] = useState(0);
  const [code, setCode] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const { said, busy, write } = useWrite();

  useEffect(() => {
    let live = true;
    loadMyApplications(me).then((l) => { if (live) setList(l); }, (e: unknown) => { if (live) setList(e instanceof Error ? e.message : 'Your applications could not be read.'); });
    return () => { live = false; };
  }, [me, reads]);
  const refresh = () => setReads((n) => n + 1);

  return (
    <section aria-label="Your application">
      <SectionLabel>Your application</SectionLabel>
      <Result said={said} />
      <Stack label="Start an application">
        <Field label="Application code" hint="The code your school gave you for its admission cycle.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={code} onChange={(e) => setCode(e.target.value.trim())} />}
        </Field>
        <ActionButton tone="primary" disabled={busy || code === ''} onClick={() => void write(`start:${code}`, (k) => startApplication(code, k), () => 'Started. Fill it in below.').then((ok) => { if (ok) { setCode(''); refresh(); } })}>Start</ActionButton>
      </Stack>
      {list === null && <p role="status">Reading your applications…</p>}
      {typeof list === 'string' && <p role="alert">{list}</p>}
      {Array.isArray(list) && list.length === 0 && <EmptyState inline title="No application yet" body="Start one with the code your school gave you." />}
      {Array.isArray(list) && list.map((a) => {
        const answers = { ...a.answers, ...(drafts[a.id] ?? {}) };
        const lacks = missingAnswers(a.cycle, answers);
        const docsLack = missingDocuments(a.cycle, a.docs);
        return (
          <section key={a.id} aria-label={`Application to ${a.cycle.name}`}>
            <SectionLabel>{a.cycle.name} · {a.cycle.term} · {a.status}</SectionLabel>
            {a.decision && (
              <Notice>
                <strong>{DECISION_WORDS[a.decision.decision]}</strong>{a.decision.conditions ? ` Conditions: ${a.decision.conditions}` : ''}
                {a.decision.decision === 'admit' && a.response === null && (
                  <Row>
                    <ActionButton tone="primary" disabled={busy} onClick={() => void write(`respond:${a.id}:accept`, (k) => respondToOffer(a.id, 'accept', k), () => 'Accepted. The school will tell you how to hold your place.').then((ok) => { if (ok) refresh(); })}>Accept</ActionButton>
                    <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`respond:${a.id}:decline`, (k) => respondToOffer(a.id, 'decline', k), () => 'Declined.').then((ok) => { if (ok) refresh(); })}>Decline</ActionButton>
                  </Row>
                )}
                {a.response && <Sub>You {a.response === 'accept' ? 'accepted' : 'declined'} this offer.{a.deposit ? ' Your deposit was received.' : ''}</Sub>}
              </Notice>
            )}
            {a.status === 'draft' && a.cycle.questions.map((q) => (
              <Field key={q.key} label={`${q.label}${q.required ? '' : ' (optional)'}`}>
                {(ids) => q.kind === 'choice'
                  ? (
                    <select id={ids.id} className="input" value={answers[q.key] ?? ''} onChange={(e) => setDrafts({ ...drafts, [a.id]: { ...(drafts[a.id] ?? {}), [q.key]: e.target.value } })}>
                      <option value="">Choose one</option>
                      {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )
                  : <textarea id={ids.id} className="input" rows={3} value={answers[q.key] ?? ''} onChange={(e) => setDrafts({ ...drafts, [a.id]: { ...(drafts[a.id] ?? {}), [q.key]: e.target.value } })} />}
              </Field>
            ))}
            {a.status !== 'draft' && a.cycle.questions.map((q) => <Sub key={q.key}><strong>{q.label}</strong>: {a.answers[q.key] || '—'}</Sub>)}
            {a.status !== 'withdrawn' && a.cycle.checklist.length > 0 && (
              <Rows label="Documents">
                {a.cycle.checklist.map((c) => (
                  <RowItem key={c.key}>
                    <div><strong>{c.label}</strong>{c.required ? '' : ' (optional)'} · {a.docs[c.key] === 'received' ? 'received' : a.docs[c.key] === 'waived' ? 'waived' : a.docs[c.key] === 'sent' ? 'sent, waiting for the school to receive it' : 'not sent'}</div>
                    {a.docs[c.key] === undefined && (
                      <Row><ActionButton tone="ghost" disabled={busy} onClick={() => void write(`sent:${a.id}:${c.key}`, (k) => markDocument(a.id, c.key, 'sent', '', k), () => 'Marked as sent.').then((ok) => { if (ok) refresh(); })}>I sent this</ActionButton></Row>
                    )}
                  </RowItem>
                ))}
              </Rows>
            )}
            {a.status === 'draft' && (
              <Row>
                <ActionButton disabled={busy} onClick={() => void write(`save:${a.id}:${JSON.stringify(answers)}`, async () => { await saveAnswers(a.id, answers); }, () => 'Saved.').then((ok) => { if (ok) refresh(); })}>Save</ActionButton>
                <ActionButton tone="primary" disabled={busy || lacks.length > 0}
                  onClick={() => void write(`submit:${a.id}`, async (k) => { await saveAnswers(a.id, answers); await submitApplication(a.id, k); }, () => 'Submitted. It can no longer be edited.').then((ok) => { if (ok) refresh(); })}>
                  Submit
                </ActionButton>
              </Row>
            )}
            {a.status === 'draft' && lacks.length > 0 && <Sub>Still to answer: {lacks.join(', ')}.</Sub>}
            {a.status === 'submitted' && docsLack.length > 0 && <Sub>The school is still waiting for: {docsLack.join(', ')}.</Sub>}
            {a.status !== 'withdrawn' && !a.decision && (
              <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`withdraw:${a.id}`, (k) => withdrawApplication(a.id, k), () => 'Withdrawn.').then((ok) => { if (ok) refresh(); })}>Withdraw</ActionButton>
            )}
          </section>
        );
      })}
    </section>
  );
}

function Office({ school, me, held }: { school: string; me: string; held: ReadonlySet<AdmissionsCapability> }): ReactNode {
  const { said, busy, write } = useWrite();
  const [cycles, setCycles] = useState<Cycle[] | string | null>(null);
  const [reads, setReads] = useState(0);
  const [picked, setPicked] = useState('');
  const [apps, setApps] = useState<OfficeApplication[]>([]);
  const [appsError, setAppsError] = useState('');
  const [counts, setCounts] = useState<Yield | null>(null);
  const [draft, setDraft] = useState({ name: '', term: '2027FA', opens: '', closes: '', questions: 'essay | Why this school | text | required', checklist: 'transcript | Secondary transcript | required' });
  const [draftError, setDraftError] = useState('');
  const [review, setReview] = useState({ id: '', recommendation: 'discuss' as 'admit' | 'deny' | 'waitlist' | 'discuss', notes: '' });
  const [decide, setDecide] = useState({ id: '', decision: 'admit' as 'admit' | 'deny' | 'waitlist', reason: '', conditions: '' });
  const [deposit, setDeposit] = useState({ id: '', reference: '' });
  const refresh = () => setReads((n) => n + 1);

  useEffect(() => {
    let live = true;
    loadCycles(school).then((c) => { if (live) { setCycles(c); if (picked === '' && c[0]) setPicked(c[0].id); } }, (e: unknown) => { if (live) setCycles(e instanceof Error ? e.message : 'The cycles could not be read.'); });
    return () => { live = false; };
  }, [school, reads, picked]);

  useEffect(() => {
    if (picked === '') return;
    let live = true;
    loadOfficeApplications(school, picked, me).then((a) => { if (live) { setApps(a); setAppsError(''); } }, (e: unknown) => { if (live) setAppsError(e instanceof Error ? e.message : 'The applications could not be read.'); });
    if (held.has('admissions:read')) loadYield(picked).then((y) => { if (live) setCounts(y); }, () => { if (live) setCounts(null); });
    return () => { live = false; };
  }, [school, picked, me, reads, held]);

  const cycle = Array.isArray(cycles) ? cycles.find((c) => c.id === picked) : undefined;
  return (
    <section aria-label="Admissions office">
      <SectionLabel>Admissions office</SectionLabel>
      <Result said={said} />
      {typeof cycles === 'string' && <p role="alert">{cycles}</p>}
      {Array.isArray(cycles) && cycles.length > 0 && (
        <Row end>
          <Field label="Cycle">
            {(ids) => (
              <select id={ids.id} className="input" value={picked} onChange={(e) => setPicked(e.target.value)}>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.term}{c.closed ? ' · closed' : c.opened ? ' · open' : ' · draft'}</option>)}
              </select>
            )}
          </Field>
          {held.has('admissions:configure') && cycle && !cycle.opened && <ActionButton disabled={busy} onClick={() => void write(`open:${cycle.id}`, (k) => openCycle(cycle.id, k), () => 'Open. Its questions are now fixed.').then((ok) => { if (ok) refresh(); })}>Open this cycle</ActionButton>}
          {held.has('admissions:configure') && cycle && cycle.opened && !cycle.closed && <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`close:${cycle.id}`, (k) => closeCycle(cycle.id, k), () => 'Closed.').then((ok) => { if (ok) refresh(); })}>Close it</ActionButton>}
          {held.has('admissions:decide') && cycle && <ActionButton disabled={busy} onClick={() => void write(`release:${cycle.id}:${Date.now()}`, (k) => releaseDecisions(cycle.id, k), (n) => `Released ${n} decision${n === 1 ? '' : 's'} to applicants.`).then((ok) => { if (ok) refresh(); })}>Release decisions</ActionButton>}
        </Row>
      )}
      {cycle && <Sub>Application code for applicants: <strong>{cycle.id}</strong></Sub>}
      {counts && <Sub>{counts.started} started · {counts.submitted} submitted · {counts.withdrawn} withdrawn · {counts.admitted} admitted · {counts.accepted} accepted · {counts.deposited} deposited</Sub>}

      {appsError !== '' && <p role="alert">{appsError}</p>}
      {apps.length > 0 && cycle && (
        <Rows label="Applications">
          {apps.map((a) => {
            const lacks = missingDocuments(cycle, a.docs);
            return (
              <RowItem key={a.id}>
                <div><strong>{a.applicant.slice(0, 8)}</strong> · {a.status} · {a.reviews.length} review{a.reviews.length === 1 ? '' : 's'}{a.decision ? ` · decided: ${a.decision}${a.released ? ' (released)' : ''}` : ''}{a.response ? ` · ${a.response}ed` : ''}{a.deposit ? ' · deposit received' : ''}</div>
                {a.status !== 'draft' && cycle.questions.map((q) => <Sub key={q.key}><strong>{q.label}</strong>: {a.answers[q.key] || '—'}</Sub>)}
                <Sub>{cycle.checklist.map((c) => `${c.label}: ${a.docs[c.key] ?? 'not sent'}`).join(' · ')}{lacks.length > 0 ? ` — still needed: ${lacks.join(', ')}` : ''}</Sub>
                {a.reviews.map((r, i) => <Sub key={i}>{r.mine ? 'Your review' : 'A review'}: {r.recommendation} — {r.notes}</Sub>)}
                {a.status === 'submitted' && (
                  <Row>
                    {held.has('admissions:review') && cycle.checklist.filter((c) => a.docs[c.key] !== 'received' && a.docs[c.key] !== 'waived').map((c) => (
                      <ActionButton key={c.key} tone="ghost" disabled={busy} onClick={() => void write(`recv:${a.id}:${c.key}`, (k) => markDocument(a.id, c.key, 'received', '', k), () => `${c.label} marked received.`).then((ok) => { if (ok) refresh(); })}>Received: {c.label}</ActionButton>
                    ))}
                    {held.has('admissions:review') && <ActionButton tone="ghost" onClick={() => setReview({ id: review.id === a.id ? '' : a.id, recommendation: 'discuss', notes: '' })}>Review…</ActionButton>}
                    {held.has('admissions:decide') && <ActionButton tone="ghost" onClick={() => setDecide({ id: decide.id === a.id ? '' : a.id, decision: 'admit', reason: '', conditions: '' })}>Decide…</ActionButton>}
                    {held.has('admissions:review') && a.response === 'accept' && !a.deposit && <ActionButton tone="ghost" onClick={() => setDeposit({ id: deposit.id === a.id ? '' : a.id, reference: '' })}>Record deposit…</ActionButton>}
                  </Row>
                )}
                {review.id === a.id && (
                  <Stack label="Review this application">
                    <Field label="Recommendation">
                      {(ids) => (
                        <select id={ids.id} className="input" value={review.recommendation} onChange={(e) => setReview({ ...review, recommendation: e.target.value as typeof review.recommendation })}>
                          <option value="admit">Admit</option><option value="deny">Deny</option><option value="waitlist">Waitlist</option><option value="discuss">Discuss</option>
                        </select>
                      )}
                    </Field>
                    <Field label="Notes">{(ids) => <textarea id={ids.id} className="input" rows={3} value={review.notes} onChange={(e) => setReview({ ...review, notes: e.target.value })} />}</Field>
                    <ActionButton tone="primary" disabled={busy || review.notes.trim() === ''} onClick={() => void write(`review:${a.id}:${review.recommendation}:${review.notes}`, (k) => reviewApplication(a.id, review.recommendation, review.notes.trim(), k), () => 'Review saved. It is never shown to the applicant.').then((ok) => { if (ok) { setReview({ id: '', recommendation: 'discuss', notes: '' }); refresh(); } })}>Save the review</ActionButton>
                  </Stack>
                )}
                {decide.id === a.id && (
                  <Stack label="Record a decision">
                    <Sub>A decision follows a review by someone other than you, and every required document received or waived. It is private until you release the cycle’s decisions.</Sub>
                    <Field label="Decision">
                      {(ids) => (
                        <select id={ids.id} className="input" value={decide.decision} onChange={(e) => setDecide({ ...decide, decision: e.target.value as typeof decide.decision })}>
                          <option value="admit">Admit</option><option value="deny">Deny</option><option value="waitlist">Waitlist</option>
                        </select>
                      )}
                    </Field>
                    <Field label="Reason" hint="At least ten characters. Kept with the decision.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={decide.reason} onChange={(e) => setDecide({ ...decide, reason: e.target.value })} />}</Field>
                    <Field label="Conditions (optional)">{(ids) => <input id={ids.id} className="input" value={decide.conditions} onChange={(e) => setDecide({ ...decide, conditions: e.target.value })} />}</Field>
                    <ActionButton tone="primary" disabled={busy || decide.reason.trim().length < 10} onClick={() => void write(`decide:${a.id}:${decide.decision}:${decide.reason}`, (k) => decideApplication(a.id, decide.decision, decide.reason.trim(), decide.conditions.trim(), k), () => 'Decision recorded. The applicant sees nothing until it is released.').then((ok) => { if (ok) { setDecide({ id: '', decision: 'admit', reason: '', conditions: '' }); refresh(); } })}>Record the decision</ActionButton>
                  </Stack>
                )}
                {deposit.id === a.id && (
                  <Stack label="Record a deposit">
                    <Field label="Receipt reference" hint="No card or bank detail belongs here.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={deposit.reference} onChange={(e) => setDeposit({ ...deposit, reference: e.target.value })} />}</Field>
                    <ActionButton tone="primary" disabled={busy || deposit.reference.trim().length < 3} onClick={() => void write(`deposit:${a.id}`, (k) => recordDeposit(a.id, deposit.reference.trim(), k), () => 'Deposit recorded.').then((ok) => { if (ok) { setDeposit({ id: '', reference: '' }); refresh(); } })}>Record it</ActionButton>
                  </Stack>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}

      {held.has('admissions:configure') && (
        <Stack label="New admission cycle">
          <Row end>
            <Field label="Name">{(ids) => <input id={ids.id} className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
            <Field label="Term">{(ids) => <input id={ids.id} className="input" value={draft.term} placeholder="2027FA" onChange={(e) => setDraft({ ...draft, term: e.target.value.toUpperCase() })} />}</Field>
          </Row>
          <Row end>
            <Field label="Opens">{(ids) => <input id={ids.id} className="input" type="datetime-local" value={draft.opens} onChange={(e) => setDraft({ ...draft, opens: e.target.value })} />}</Field>
            <Field label="Closes">{(ids) => <input id={ids.id} className="input" type="datetime-local" value={draft.closes} onChange={(e) => setDraft({ ...draft, closes: e.target.value })} />}</Field>
          </Row>
          <Field label="Questions" hint="One per line: key | Question | text or choice | required or optional | options for a choice.">
            {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={3} value={draft.questions} onChange={(e) => setDraft({ ...draft, questions: e.target.value })} />}
          </Field>
          <Field label="Document checklist" hint="One per line: key | Document | required or optional.">
            {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={3} value={draft.checklist} onChange={(e) => setDraft({ ...draft, checklist: e.target.value })} />}
          </Field>
          {draftError !== '' && <p role="alert">{draftError}</p>}
          <ActionButton tone="primary" disabled={busy || draft.name.trim() === '' || draft.opens === '' || draft.closes === ''}
            onClick={() => {
              const q = parseQuestions(draft.questions);
              if ('error' in q) { setDraftError(q.error); return; }
              const c = parseChecklist(draft.checklist);
              if ('error' in c) { setDraftError(c.error); return; }
              setDraftError('');
              void write(`cycle:${draft.name}:${draft.term}:${draft.opens}`,
                (k) => saveCycle({ name: draft.name.trim(), term: draft.term, opens: new Date(draft.opens).toISOString(), closes: new Date(draft.closes).toISOString(), questions: q.questions, checklist: c.items }, k),
                () => 'Saved as a draft. Open it when it is right; its questions are fixed after.').then((ok) => { if (ok) refresh(); });
            }}>
            Save as a draft
          </ActionButton>
          {cycle && <Sub>The most recent cycle was {cycle.name}, {at(cycle.opensAt)} to {at(cycle.closesAt)}.</Sub>}
        </Stack>
      )}
    </section>
  );
}
