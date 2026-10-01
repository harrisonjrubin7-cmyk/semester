import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { formatDateTime } from '../../lib/locale';
import {
  canConfigureAdvancement, canRecordGifts, canRefundGifts, canSeeDonors, dollars, loadDesk, loadMyProfile, optIn, percentOf, recordGift, refundGift, saveDonor,
  saveFund, saveSettings, setPreferences, toCents, type AlumniProfile, type Desk,
} from '../../lib/advancement/client';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const day = (iso: string): string => { try { return formatDateTime(`${iso}T12:00:00Z`, { dateStyle: 'medium' }); } catch { return iso; } };

/**
 * Alumni relations and fundraising, in a school that runs them in Core: a
 * graduate’s own opt-in and preferences, and for gift officers the donor desk,
 * gifts, campaign progress and the school’s receipt wording. In Connect it says
 * the school’s own system holds them and stops. Whether a gift is recorded,
 * receipted or refunded is the database’s answer
 * (`20261001100000_advancement.sql`). No payment is taken here and nobody is
 * scored.
 */
export function AdvancementHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to see alumni relations. They are your school’s, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs alumni relations in Semester…</p>;
  const mode = resolveModuleMode('advancement', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own system holds alumni relations and fundraising. Semester shows them here only when your school switches advancement to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read your roles at this school. Nothing has changed. Try again in a moment.</Notice>;
  return (
    <section aria-label="Alumni relations">
      <SectionLabel>Alumni</SectionLabel>
      <Alumnus school={school.id} me={me} />
      {canSeeDonors(grants, school.id) && <DonorDesk school={school.id} record={canRecordGifts(grants, school.id)} refund={canRefundGifts(grants, school.id)} configure={canConfigureAdvancement(grants, school.id)} />}
    </section>
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

function Alumnus({ school, me }: { school: string; me: string }): ReactNode {
  const [profile, setProfile] = useState<AlumniProfile | null | 'error' | undefined>(undefined);
  const [reads, setReads] = useState(0);
  const { said, busy, write } = useWrite();
  const [name, setName] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    let live = true;
    loadMyProfile(me, school).then((p) => { if (live) setProfile(p); }, () => { if (live) setProfile('error'); });
    return () => { live = false; };
  }, [school, me, reads]);

  const refresh = () => setReads((n) => n + 1);
  const y = Number(year);
  return (
    <Stack label="Your alumni profile">
      <Result said={said} />
      {profile === undefined && <p role="status">Reading your profile…</p>}
      {profile === 'error' && <p role="alert">Your alumni profile could not be read.</p>}
      {profile === null && (
        <>
          <Sub>Graduates of this school can join the alumni community. It is your choice, and it is open only after a degree has been conferred. Nothing about your studies is shared.</Sub>
          <Row end>
            <Field label="Name to show">{(ids) => <input id={ids.id} className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label="Class year">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />}</Field>
          </Row>
          <ActionButton tone="primary" disabled={busy || name.trim() === '' || !(y >= 1900 && y <= 2200)}
            onClick={() => void write(`optin:${me}:${y}`, (k) => optIn(name.trim(), y, k), () => 'You are in the alumni community.').then((ok) => { if (ok) refresh(); })}>Join the alumni community</ActionButton>
        </>
      )}
      {profile && profile !== 'error' && (
        <>
          <div><strong>{profile.displayName}</strong> · class of {profile.classYear}{profile.optedOut ? ' · opted out of all contact' : ''}</div>
          <Row>
            <ActionButton tone="ghost" disabled={busy || profile.optedOut} onClick={() => void write(`dir:${me}:${!profile.directory}`, (k) => setPreferences({ directory: !profile.directory, solicitable: profile.solicitable, optOut: false }, k), () => (profile.directory ? 'You are hidden from the directory.' : 'You are in the directory.')).then((ok) => { if (ok) refresh(); })}>
              {profile.directory ? 'Hide me from the directory' : 'Show me in the directory'}
            </ActionButton>
            <ActionButton tone="ghost" disabled={busy || profile.optedOut} onClick={() => void write(`sol:${me}:${!profile.solicitable}`, (k) => setPreferences({ directory: profile.directory, solicitable: !profile.solicitable, optOut: false }, k), () => (profile.solicitable ? 'The school will not ask you for gifts.' : 'The school may ask you for gifts.')).then((ok) => { if (ok) refresh(); })}>
              {profile.solicitable ? 'Do not ask me for gifts' : 'The school may ask me for gifts'}
            </ActionButton>
            {!profile.optedOut && (
              <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`out:${me}`, (k) => setPreferences({ directory: false, solicitable: false, optOut: true }, k), () => 'You are opted out of all alumni contact.').then((ok) => { if (ok) refresh(); })}>Opt out of everything</ActionButton>
            )}
          </Row>
        </>
      )}
    </Stack>
  );
}

function DonorDesk({ school, record, refund, configure }: { school: string; record: boolean; refund: boolean; configure: boolean }): ReactNode {
  const [desk, setDesk] = useState<Desk | string | null>(null);
  const [reads, setReads] = useState(0);
  const { said, busy, write } = useWrite();
  const [wording, setWording] = useState({ legal: '', statement: '', goods: '' });
  const [fund, setFund] = useState({ code: '', name: '', designation: 'unrestricted' });
  const [donor, setDonor] = useState({ kind: 'friend', name: '', email: '' });
  const [gift, setGift] = useState({ donor: '', fund: '', campaign: '', amount: '', received: '', method: 'check', reference: '', tribute: '' });
  const [refunding, setRefunding] = useState({ id: '', reason: '', reference: '' });
  const refresh = () => setReads((n) => n + 1);

  useEffect(() => {
    let live = true;
    loadDesk(school).then((d) => { if (live) setDesk(d); }, (e: unknown) => { if (live) setDesk(e instanceof Error ? e.message : 'The fundraising records could not be read.'); });
    return () => { live = false; };
  }, [school, reads]);

  if (desk === null) return <p role="status">Reading the donor desk…</p>;
  if (typeof desk === 'string') return <p role="alert">{desk}</p>;
  const cents = toCents(gift.amount);
  const nameOf = (id: string) => desk.donors.find((d) => d.id === id)?.name ?? 'a donor';

  return (
    <Stack label="Donor desk">
      <Result said={said} />
      {!desk.hasWording && <Notice>This school has not set its receipt wording, so no gift can be recorded yet. {configure ? 'Set it below; your counsel decides what it says.' : 'A director sets it.'}</Notice>}

      {desk.campaigns.length > 0 && (
        <Rows label="Campaigns">
          {desk.campaigns.map((c) => (
            <RowItem key={c.id}>
              <div><strong>{c.name}</strong> · {c.kind === 'giving_day' ? 'giving day' : 'campaign'} · {day(c.startsOn)} to {day(c.endsOn)}</div>
              <Sub>{dollars(c.raisedCents)} of {dollars(c.goalCents)} ({percentOf(c.raisedCents, c.goalCents)}%) from {c.gifts} gift{c.gifts === 1 ? '' : 's'}; refunded gifts are not counted.</Sub>
            </RowItem>
          ))}
        </Rows>
      )}

      {desk.gifts.length === 0 ? <EmptyState inline title="No gifts recorded" body="A gift is recorded by hand when it arrives; this module takes no payment." /> : (
        <Rows label="Recent gifts">
          {desk.gifts.map((g) => (
            <RowItem key={g.id}>
              <div>{dollars(g.amountCents)} from {nameOf(g.donorId)} · {day(g.receivedOn)} · {g.method}{g.receipt ? ` · receipt ${g.receipt}` : ''}{g.refunded ? ' · refunded' : ''}</div>
              {refund && !g.refunded && <Row><ActionButton tone="ghost" onClick={() => setRefunding({ id: refunding.id === g.id ? '' : g.id, reason: '', reference: '' })}>Refund…</ActionButton></Row>}
              {refunding.id === g.id && (
                <Stack label="Refund this gift">
                  <Sub>Someone other than the person who recorded a gift refunds it. The gift stays on record.</Sub>
                  <Field label="Reason" hint="At least ten characters.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={refunding.reason} onChange={(e) => setRefunding({ ...refunding, reason: e.target.value })} />}</Field>
                  <Field label="Reference (optional)">{(ids) => <input id={ids.id} className="input" value={refunding.reference} onChange={(e) => setRefunding({ ...refunding, reference: e.target.value })} />}</Field>
                  <ActionButton tone="primary" disabled={busy || refunding.reason.trim().length < 10} onClick={() => void write(`refund:${g.id}`, (k) => refundGift(g.id, refunding.reason.trim(), refunding.reference.trim(), k), () => 'Refunded.').then((ok) => { if (ok) { setRefunding({ id: '', reason: '', reference: '' }); refresh(); } })}>Refund it</ActionButton>
                </Stack>
              )}
            </RowItem>
          ))}
        </Rows>
      )}

      {record && (
        <Stack label="Record a gift">
          <Row end>
            <Field label="Donor">{(ids) => <select id={ids.id} className="input" value={gift.donor} onChange={(e) => setGift({ ...gift, donor: e.target.value })}><option value="">Choose…</option>{desk.donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}</Field>
            <Field label="Fund">{(ids) => <select id={ids.id} className="input" value={gift.fund} onChange={(e) => setGift({ ...gift, fund: e.target.value })}><option value="">Choose…</option>{desk.funds.map((f) => <option key={f.id} value={f.code}>{f.code} · {f.name}</option>)}</select>}</Field>
            <Field label="Campaign (optional)">{(ids) => <select id={ids.id} className="input" value={gift.campaign} onChange={(e) => setGift({ ...gift, campaign: e.target.value })}><option value="">None</option>{desk.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
          </Row>
          <Row end>
            <Field label="Amount, in dollars">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={gift.amount} onChange={(e) => setGift({ ...gift, amount: e.target.value })} />}</Field>
            <Field label="Received on">{(ids) => <input id={ids.id} className="input" type="date" value={gift.received} onChange={(e) => setGift({ ...gift, received: e.target.value })} />}</Field>
            <Field label="How it arrived">{(ids) => <select id={ids.id} className="input" value={gift.method} onChange={(e) => setGift({ ...gift, method: e.target.value })}>{['check', 'cash', 'wire', 'stock', 'card', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}</select>}</Field>
          </Row>
          <Row end>
            <Field label="Reference" hint="A check number or transfer id; at least three characters.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={gift.reference} onChange={(e) => setGift({ ...gift, reference: e.target.value })} />}</Field>
            <Field label="In honor of (optional)">{(ids) => <input id={ids.id} className="input" value={gift.tribute} maxLength={300} onChange={(e) => setGift({ ...gift, tribute: e.target.value })} />}</Field>
          </Row>
          <ActionButton tone="primary" disabled={busy || !desk.hasWording || gift.donor === '' || gift.fund === '' || cents === null || gift.received === '' || gift.reference.trim().length < 3}
            onClick={() => void write(`gift:${gift.donor}:${gift.reference}:${gift.received}`, (k) => recordGift({ donor: gift.donor, fund: gift.fund, campaign: gift.campaign || null, cents: cents ?? 0, received: gift.received, method: gift.method, reference: gift.reference.trim(), tribute: gift.tribute.trim() }, k),
              (r) => `Recorded. Receipt ${String(r.receipt ?? '')} issued.`).then((ok) => { if (ok) { setGift({ ...gift, amount: '', reference: '', tribute: '' }); refresh(); } })}>Record the gift</ActionButton>
        </Stack>
      )}

      {record && (
        <Stack label="Add a donor">
          <Row end>
            <Field label="Kind">{(ids) => <select id={ids.id} className="input" value={donor.kind} onChange={(e) => setDonor({ ...donor, kind: e.target.value })}>{['friend', 'parent', 'organization', 'alumnus'].map((k) => <option key={k} value={k}>{k}</option>)}</select>}</Field>
            <Field label="Name">{(ids) => <input id={ids.id} className="input" value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} />}</Field>
            <Field label="Email (optional)">{(ids) => <input id={ids.id} className="input" type="email" value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} />}</Field>
          </Row>
          <ActionButton disabled={busy || donor.name.trim() === '' || donor.kind === 'alumnus'} onClick={() => void write(`donor:${donor.kind}:${donor.name}`, (k) => saveDonor(donor.kind, donor.name.trim(), donor.email.trim(), k), () => 'Donor added.').then((ok) => { if (ok) { setDonor({ ...donor, name: '', email: '' }); refresh(); } })}>Add the donor</ActionButton>
          {donor.kind === 'alumnus' && <Sub>An alumnus is linked from their own opt-in, not typed here.</Sub>}
        </Stack>
      )}

      {configure && (
        <>
          <Stack label="Receipt wording">
            <Sub>Your school’s counsel decides what a receipt says. Semester prints exactly this, and issues no receipt at all until it is set. It is not tax advice.</Sub>
            <Field label="Legal name of the school">{(ids) => <input id={ids.id} className="input" value={wording.legal} onChange={(e) => setWording({ ...wording, legal: e.target.value })} />}</Field>
            <Field label="Receipt statement" hint="At least twenty characters.">{(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={3} value={wording.statement} onChange={(e) => setWording({ ...wording, statement: e.target.value })} />}</Field>
            <Field label="Goods or services note (optional)">{(ids) => <input id={ids.id} className="input" value={wording.goods} onChange={(e) => setWording({ ...wording, goods: e.target.value })} />}</Field>
            <ActionButton tone="primary" disabled={busy || wording.legal.trim().length < 2 || wording.statement.trim().length < 20}
              onClick={() => void write(`wording:${wording.legal}:${wording.statement.length}`, (k) => saveSettings(wording.legal.trim(), wording.statement.trim(), wording.goods.trim(), k), () => 'Saved. Receipts issued from now on use this wording.').then((ok) => { if (ok) refresh(); })}>Save the wording</ActionButton>
          </Stack>
          <Stack label="Add a fund">
            <Row end>
              <Field label="Code" hint="Capitals, digits and dashes.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={fund.code} onChange={(e) => setFund({ ...fund, code: e.target.value.toUpperCase() })} />}</Field>
              <Field label="Name">{(ids) => <input id={ids.id} className="input" value={fund.name} onChange={(e) => setFund({ ...fund, name: e.target.value })} />}</Field>
              <Field label="Designation">{(ids) => <select id={ids.id} className="input" value={fund.designation} onChange={(e) => setFund({ ...fund, designation: e.target.value })}>{['unrestricted', 'restricted', 'endowment'].map((k) => <option key={k} value={k}>{k}</option>)}</select>}</Field>
            </Row>
            <ActionButton disabled={busy || fund.code.trim() === '' || fund.name.trim() === ''} onClick={() => void write(`fund:${fund.code}`, (k) => saveFund(fund.code.trim(), fund.name.trim(), fund.designation, k), () => 'Fund saved.').then((ok) => { if (ok) { setFund({ ...fund, code: '', name: '' }); refresh(); } })}>Save the fund</ActionButton>
          </Stack>
        </>
      )}
    </Stack>
  );
}
