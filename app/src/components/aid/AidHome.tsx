import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { formatDateTime } from '../../lib/locale';
import {
  KIND_WORDS, aidCapabilities, approveOffer, determine, disburse, dollars, evaluateProgress, loadEvaluations, loadOffers, loadStandings, parseComponents,
  proposeOffer, respondToComponent, setPolicy, toCents,
  type AidCapability, type Evaluation, type OfferVersion, type Standing,
} from '../../lib/aid/client';
import { ActionButton, EmptyState, Notice, SectionLabel, TabList } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
type View = 'mine' | 'office';

const STANDING_WORDS: Record<Standing['determination'], string> = {
  satisfactory: 'Making satisfactory progress', warning: 'On warning', suspended: 'Aid suspended', reinstated: 'Reinstated after appeal',
};

/**
 * Financial aid, in a school that runs it in Core: your own offer and answers,
 * and the aid office. In Connect it says the school’s own system holds aid and
 * stops. Offers, approvals, disbursement records and standing are the
 * database’s (`20261001070000_financial_aid.sql`); this asks and shows them. A
 * person decides every offer and every standing; nothing here moves money.
 */
export function AidHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [view, setView] = useState<View>('mine');

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to see financial aid. It is your school’s record, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs financial aid in Semester…</p>;
  const mode = resolveModuleMode('financial_aid', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own system holds your financial aid. Semester shows offers here only when your school switches financial aid to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read your roles at this school. Nothing has changed. Try again in a moment.</Notice>;
  const held = aidCapabilities(grants, school.id);
  const showing: View = held.size > 0 ? view : 'mine';
  return (
    <>
      {held.size > 0 && <TabList label="Financial aid views" value={showing} onChange={setView} tabs={[{ id: 'mine', label: 'Your aid' }, { id: 'office', label: 'Aid office' }]} />}
      {showing === 'mine' ? <MyAid school={school.id} me={me} /> : <Office school={school.id} me={me} held={held} />}
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

function MyAid({ school, me }: { school: string; me: string }): ReactNode {
  const [offers, setOffers] = useState<OfferVersion[] | string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [reads, setReads] = useState(0);
  const { said, busy, write } = useWrite();

  useEffect(() => {
    let live = true;
    Promise.all([loadOffers(school, me), loadStandings(school)]).then(
      ([o, s]) => { if (live) { setOffers(o); setStandings(s); } },
      (e: unknown) => { if (live) setOffers(e instanceof Error ? e.message : 'Your aid could not be read.'); },
    );
    return () => { live = false; };
  }, [school, me, reads]);

  if (offers === null) return <p role="status">Reading your aid…</p>;
  if (typeof offers === 'string') return <p role="alert">{offers}</p>;
  const current = offers.filter((o) => o.latest && o.approved);
  return (
    <section aria-label="Your aid">
      <SectionLabel>Your aid</SectionLabel>
      <Result said={said} />
      {current.length === 0 && <EmptyState inline title="No offer yet" body="When your school approves an aid offer for you, it appears here and you can accept or decline each part." />}
      {current.map((o) => (
        <section key={o.id} aria-label={`Aid offer for ${o.aidYear}`}>
          <SectionLabel>{o.aidYear} · version {o.version}</SectionLabel>
          {o.note && <Sub>{o.note}</Sub>}
          <Rows label="Parts of your offer">
            {o.components.map((c) => (
              <RowItem key={c.key}>
                <div><strong>{c.name}</strong> · {KIND_WORDS[c.kind]} · {dollars(c.amount_cents)} · {o.answers[c.key] === 'accept' ? 'accepted' : o.answers[c.key] === 'decline' ? 'declined' : 'waiting for your answer'}</div>
                {o.disbursed[c.key] !== undefined && <Sub>{dollars(o.disbursed[c.key])} disbursed so far, recorded by your school.</Sub>}
                {o.answers[c.key] === undefined && (
                  <Row>
                    <ActionButton tone="primary" disabled={busy} onClick={() => void write(`respond:${o.id}:${c.key}:accept`, (k) => respondToComponent(o.id, c.key, 'accept', k), () => `Accepted ${c.name}.`).then((ok) => { if (ok) setReads((n) => n + 1); })}>Accept</ActionButton>
                    <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`respond:${o.id}:${c.key}:decline`, (k) => respondToComponent(o.id, c.key, 'decline', k), () => `Declined ${c.name}.`).then((ok) => { if (ok) setReads((n) => n + 1); })}>Decline</ActionButton>
                  </Row>
                )}
              </RowItem>
            ))}
          </Rows>
        </section>
      ))}
      {standings.length > 0 && (
        <>
          <SectionLabel>Satisfactory academic progress</SectionLabel>
          {standings.slice(0, 3).map((s) => <Sub key={s.id}><strong>{s.aidYear}</strong>: {STANDING_WORDS[s.determination]} · {at(s.decidedAt)} — {s.reason}</Sub>)}
        </>
      )}
    </section>
  );
}

function Office({ school, me, held }: { school: string; me: string; held: ReadonlySet<AidCapability> }): ReactNode {
  const { said, busy, write } = useWrite();
  const [offers, setOffers] = useState<OfferVersion[] | string | null>(null);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [reads, setReads] = useState(0);
  const [prop, setProp] = useState({ student: '', year: '2026-27', note: '', components: 'pell | grant | Pell Grant | 3,000.00' });
  const [propError, setPropError] = useState('');
  const [disb, setDisb] = useState({ id: '', component: '', term: '', amount: '', reference: '' });
  const [policy, setPolicyForm] = useState({ gpa: '2.0', completion: '67', note: '' });
  const [evalStudent, setEvalStudent] = useState('');
  const [det, setDet] = useState({ id: '', year: '2026-27', determination: 'warning' as Standing['determination'], reason: '' });
  const refresh = () => setReads((n) => n + 1);

  useEffect(() => {
    let live = true;
    if (!held.has('aid:read')) return;
    Promise.all([loadOffers(school, me), loadEvaluations(school, me), loadStandings(school)]).then(
      ([o, e, s]) => { if (live) { setOffers(o); setEvals(e); setStandings(s); } },
      (e: unknown) => { if (live) setOffers(e instanceof Error ? e.message : 'The aid office’s records could not be read.'); },
    );
    return () => { live = false; };
  }, [school, me, reads, held]);

  return (
    <section aria-label="Aid office">
      <SectionLabel>Aid office</SectionLabel>
      <Result said={said} />
      {typeof offers === 'string' && <p role="alert">{offers}</p>}

      {held.has('aid:propose') && (
        <Stack label="Propose an offer">
          <Row end>
            <Field label="Student’s record reference">{(ids) => <input id={ids.id} className="input" value={prop.student} onChange={(e) => setProp({ ...prop, student: e.target.value.trim() })} />}</Field>
            <Field label="Aid year">{(ids) => <input id={ids.id} className="input" value={prop.year} placeholder="2026-27" onChange={(e) => setProp({ ...prop, year: e.target.value.trim() })} />}</Field>
          </Row>
          <Field label="Components" hint="One per line: key | grant, scholarship, loan or work_study | name | amount in dollars.">
            {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={3} value={prop.components} onChange={(e) => setProp({ ...prop, components: e.target.value })} />}
          </Field>
          <Field label="Note to the student (optional)">{(ids) => <input id={ids.id} className="input" value={prop.note} onChange={(e) => setProp({ ...prop, note: e.target.value })} />}</Field>
          {propError !== '' && <p role="alert">{propError}</p>}
          <ActionButton tone="primary" disabled={busy || prop.student === ''}
            onClick={() => {
              const parsed = parseComponents(prop.components);
              if ('error' in parsed) { setPropError(parsed.error); return; }
              setPropError('');
              void write(`propose:${prop.student}:${prop.year}:${prop.components}:${prop.note}`, (k) => proposeOffer(prop.student, prop.year, parsed.components, prop.note.trim(), k),
                (r) => `Saved as version ${String(r.version)}. A different person approves it before the student sees it.`).then((ok) => { if (ok) refresh(); });
            }}>
            Save this version
          </ActionButton>
        </Stack>
      )}

      {Array.isArray(offers) && offers.length > 0 && (
        <Rows label="Offers">
          {offers.filter((o) => o.latest).map((o) => (
            <RowItem key={o.id}>
              <div><strong>{o.studentRef}</strong> · {o.aidYear} · version {o.version} · {o.approved ? 'approved' : 'waiting for approval'}</div>
              <Sub>{o.components.map((c) => `${c.name} ${dollars(c.amount_cents)} (${o.answers[c.key] ?? 'unanswered'}${o.disbursed[c.key] ? `, ${dollars(o.disbursed[c.key])} out` : ''})`).join(' · ')}</Sub>
              <Row>
                {held.has('aid:approve') && !o.approved && (o.proposedByMe
                  ? <Sub>You proposed this, so someone else approves it.</Sub>
                  : <ActionButton disabled={busy} onClick={() => void write(`approve:${o.id}`, (k) => approveOffer(o.id, k), () => 'Approved. The student can see it now.').then((ok) => { if (ok) refresh(); })}>Approve</ActionButton>)}
                {held.has('aid:disburse') && o.approved && o.components.some((c) => o.answers[c.key] === 'accept') && (
                  <ActionButton tone="ghost" onClick={() => setDisb({ id: disb.id === o.id ? '' : o.id, component: o.components.find((c) => o.answers[c.key] === 'accept')?.key ?? '', term: '', amount: '', reference: '' })}>Record a disbursement…</ActionButton>
                )}
              </Row>
              {disb.id === o.id && (
                <Stack label="Record a disbursement">
                  <Row end>
                    <Field label="Part">
                      {(ids) => (
                        <select id={ids.id} className="input" value={disb.component} onChange={(e) => setDisb({ ...disb, component: e.target.value })}>
                          {o.components.filter((c) => o.answers[c.key] === 'accept').map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label="Term">{(ids) => <input id={ids.id} className="input" value={disb.term} placeholder="2026FA" onChange={(e) => setDisb({ ...disb, term: e.target.value.toUpperCase() })} />}</Field>
                    <Field label="Amount (dollars)">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={disb.amount} onChange={(e) => setDisb({ ...disb, amount: e.target.value })} />}</Field>
                  </Row>
                  <Field label="Reference" hint="A receipt or batch reference. No bank detail belongs here.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={disb.reference} onChange={(e) => setDisb({ ...disb, reference: e.target.value })} />}</Field>
                  <ActionButton tone="primary" disabled={busy || toCents(disb.amount) === null || disb.term === '' || disb.reference.trim().length < 3}
                    onClick={() => void write(`disburse:${o.id}:${disb.component}:${disb.term}:${disb.amount}:${disb.reference}`, (k) => disburse(o.id, disb.component, disb.term, toCents(disb.amount) ?? 0, disb.reference.trim(), k),
                      (r) => `Recorded. ${dollars(Number(r.remaining_cents) || 0)} of that part remains. This records the disbursement; the bursar posts it to the student’s account.`).then((ok) => { if (ok) { setDisb({ id: '', component: '', term: '', amount: '', reference: '' }); refresh(); } })}>
                    Record it
                  </ActionButton>
                </Stack>
              )}
            </RowItem>
          ))}
        </Rows>
      )}

      {held.has('aid:determine') && (
        <Stack label="Satisfactory-progress policy">
          <Row end>
            <Field label="Minimum GPA">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={policy.gpa} onChange={(e) => setPolicyForm({ ...policy, gpa: e.target.value })} />}</Field>
            <Field label="Minimum completion rate (%)">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={policy.completion} onChange={(e) => setPolicyForm({ ...policy, completion: e.target.value })} />}</Field>
          </Row>
          <Field label="Note">{(ids) => <input id={ids.id} className="input" value={policy.note} onChange={(e) => setPolicyForm({ ...policy, note: e.target.value })} />}</Field>
          <ActionButton disabled={busy || !(Number(policy.gpa) >= 0) || !(Number(policy.completion) > 0)}
            onClick={() => void write(`policy:${policy.gpa}:${policy.completion}:${policy.note}`, (k) => setPolicy(Number(policy.gpa), Number(policy.completion), policy.note.trim(), k), (r) => `Saved as version ${String(r.version)}. Earlier versions stay.`)}>
            Save a new policy version
          </ActionButton>
        </Stack>
      )}

      {held.has('aid:evaluate') && (
        <Stack label="Evaluate progress">
          <Row end>
            <Field label="Student’s record reference">{(ids) => <input id={ids.id} className="input" value={evalStudent} onChange={(e) => setEvalStudent(e.target.value.trim())} />}</Field>
            <ActionButton tone="primary" disabled={busy || evalStudent === ''}
              onClick={() => void write(`evaluate:${evalStudent}:${Date.now()}`, (k) => evaluateProgress(evalStudent, k),
                (r) => `${r.gpa === null ? 'No graded courses' : `GPA ${r.gpa.toFixed(2)}`} · ${r.completion === null ? 'nothing attempted' : `${r.completion}% completed`}: ${r.meetsGpa && r.meetsCompletion ? 'meets the policy' : 'does not meet the policy'}${r.withoutEntry > 0 ? `. ${r.withoutEntry} course${r.withoutEntry === 1 ? ' has' : 's have'} no credit entry and count for nothing.` : ''}. A person decides the standing.`).then((ok) => { if (ok) refresh(); })}>
              Run the evaluation
            </ActionButton>
          </Row>
          <Sub>The rule reads the academic record: GPA from letter grades weighted by credits, completion as credits earned over credits attempted, transfer credit in both.</Sub>
        </Stack>
      )}

      {held.has('aid:read') && evals.length > 0 && (
        <Rows label="Recent evaluations">
          {evals.slice(0, 20).map((e) => (
            <RowItem key={e.id}>
              <div><strong>{e.studentRef}</strong> · {e.gpa === null ? 'no GPA' : `GPA ${e.gpa.toFixed(2)}`} · {e.completionPct === null ? 'nothing attempted' : `${e.completionPct}% (${e.earned} of ${e.attempted})`} · {e.meetsGpa && e.meetsCompletion ? 'meets the policy' : 'does not meet the policy'} · {at(e.evaluatedAt)}</div>
              {held.has('aid:determine') && (e.mine
                ? <Sub>You ran this evaluation, so someone else decides the standing.</Sub>
                : <Row><ActionButton tone="ghost" onClick={() => setDet({ id: det.id === e.id ? '' : e.id, year: '2026-27', determination: e.meetsGpa && e.meetsCompletion ? 'satisfactory' : 'warning', reason: '' })}>Decide the standing…</ActionButton></Row>)}
              {det.id === e.id && (
                <Stack label="Decide a standing">
                  <Row end>
                    <Field label="Aid year">{(ids) => <input id={ids.id} className="input" value={det.year} onChange={(e2) => setDet({ ...det, year: e2.target.value.trim() })} />}</Field>
                    <Field label="Standing">
                      {(ids) => (
                        <select id={ids.id} className="input" value={det.determination} onChange={(e2) => setDet({ ...det, determination: e2.target.value as Standing['determination'] })}>
                          {(Object.keys(STANDING_WORDS) as Standing['determination'][]).map((k) => <option key={k} value={k}>{STANDING_WORDS[k]}</option>)}
                        </select>
                      )}
                    </Field>
                  </Row>
                  <Field label="Reason" hint="At least ten characters; a reinstatement needs twenty. The student reads it.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={det.reason} onChange={(e2) => setDet({ ...det, reason: e2.target.value })} />}</Field>
                  <ActionButton tone="primary" disabled={busy || det.reason.trim().length < 10}
                    onClick={() => void write(`determine:${e.id}:${det.year}:${det.determination}:${det.reason}`, (k) => determine(e.id, det.year, det.determination, det.reason.trim(), k), () => 'Recorded.').then((ok) => { if (ok) { setDet({ id: '', year: '2026-27', determination: 'warning', reason: '' }); refresh(); } })}>
                    Record the standing
                  </ActionButton>
                </Stack>
              )}
            </RowItem>
          ))}
        </Rows>
      )}
      {held.has('aid:read') && standings.length > 0 && (
        <Rows label="Standings">
          {standings.slice(0, 20).map((s) => <RowItem key={s.id}><div><strong>{s.studentRef}</strong> · {s.aidYear} · {STANDING_WORDS[s.determination]} · {at(s.decidedAt)}</div><Sub>{s.reason}</Sub></RowItem>)}
        </Rows>
      )}
    </section>
  );
}
