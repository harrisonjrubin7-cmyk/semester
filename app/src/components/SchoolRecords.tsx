/**
 * What your school has shared, on Today and on the privacy page.
 *
 * `SchoolRecords` is a Today section: official campus alerts first, then
 * registration readiness, holds, enrollment, degree-audit status, an advising
 * appointment and referrals, bursar action items (never an amount), and the
 * next career deadline and campus event, each with where it came from and how
 * fresh it is. It draws nothing unless the school has turned on
 * `module.source_freshness_cards` and something has actually been shared — so
 * on nearly every account, and on every build without an account service, it
 * is not there at all.
 *
 * `SchoolDataPanel` is the other half and is **not** behind the flag: if a
 * school has sent anything about you, you can see what, why, from whom, and
 * delete it or revoke the consent that let it in. Transparency is not a
 * feature a school turns on.
 */
import { useEffect, useState } from 'react';
import { cloud, cloudConfigured } from '../lib/cloud';
import { claimedSchool } from '../lib/schoolclaim';
import { useNow } from '../state/store';
import { FRESHNESS_TEXT } from '../lib/integration/freshness';
import {
  PURPOSE, buildEnvironment, cardsEnabled, effectiveFreshness, forgetMine, loadConsents, loadRecords,
  revokeConsent, schoolRecordsView, type Fact, type IntegrationConsent, type RecordRow,
} from '../lib/integration/school-records';
import { ActionButton, SectionLabel } from './ui';
import { Folding } from './Fold';

type Loaded =
  | { status: 'loading' | 'off' | 'error' }
  | { status: 'ready'; userId: string; rows: RecordRow[] };

async function signedIn(): Promise<{ db: Awaited<ReturnType<typeof cloud>>; userId: string } | null> {
  if (!cloudConfigured) return null;
  const db = await cloud();
  const { data } = await db.auth.getUser();
  return data.user?.id ? { db, userId: data.user.id } : null;
}

function FactLine({ fact }: { fact: Fact }) {
  return (
    <div className="school-fact">
      <div className="school-fact-text">{fact.text}</div>
      <div className="school-fact-meta">
        {FRESHNESS_TEXT[fact.freshness]} · from {fact.source}
        {!fact.official && ' · Not the official current record'}
        {fact.link && (
          <>
            {' · '}
            <a href={fact.link} target="_blank" rel="noopener noreferrer">{fact.linkLabel ?? 'Open the official page'}</a>
          </>
        )}
      </div>
      {fact.caveat && <div className="school-fact-meta">{fact.caveat}</div>}
    </div>
  );
}

export function SchoolRecords() {
  const now = useNow();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    void (async () => {
      const who = await signedIn();
      if (!who) return { status: 'off' as const };
      const school = await claimedSchool();
      if (!(await cardsEnabled(who.db, school, buildEnvironment(import.meta.env.MODE), new Date()))) {
        return { status: 'off' as const };
      }
      return { status: 'ready' as const, userId: who.userId, rows: await loadRecords(who.db) };
    })().then((next) => { if (live) setLoaded(next); }, () => { if (live) setLoaded({ status: 'error' }); });
    return () => { live = false; };
  }, []);

  if (loaded.status !== 'ready') return null;
  const view = schoolRecordsView(loaded.rows, loaded.userId, now);
  if (view.empty) return null;

  return (
    <Folding name="School">
      <section className="school-records" aria-label="From your school">
        <SectionLabel style={{ marginTop: 0, marginInline: 0 }}>From your school</SectionLabel>
        {/* Alerts before everything: they are the one thing here that can be about right now. */}
        {view.alerts.map((a) => <FactLine key={a.id} fact={a} />)}
        {view.readiness === 'blocked' && (
          <p className="school-readiness" role="status">Something needs doing before you can register.</p>
        )}
        {view.readiness === 'no_hold_on_record' && (
          <p className="school-readiness" role="status">
            No registration hold on record — confirm on your registrar&rsquo;s page before your window.
          </p>
        )}
        {view.holds.map((h) => <FactLine key={h.id} fact={h} />)}
        {view.window && <FactLine fact={view.window} />}
        {view.enrollment && <FactLine fact={view.enrollment} />}
        {view.requirements && <FactLine fact={view.requirements} />}
        {view.appointment && <FactLine fact={view.appointment} />}
        {view.referrals.map((r) => <FactLine key={r.id} fact={r} />)}
        {view.actions.map((a) => <FactLine key={a.id} fact={a} />)}
        {view.opportunity && <FactLine fact={view.opportunity} />}
        {view.event && <FactLine fact={view.event} />}
      </section>
    </Folding>
  );
}

/** A second press, so nothing here happens by a slipped thumb. */
function TwoStep({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return armed ? (
    <span className="school-twostep">
      <ActionButton tone="primary" disabled={busy} style={{ width: 'auto' }}
        onClick={() => { setBusy(true); void onConfirm().finally(() => { setBusy(false); setArmed(false); }); }}>
        {confirm}
      </ActionButton>
      <ActionButton tone="ghost" style={{ width: 'auto' }} onClick={() => setArmed(false)}>Cancel</ActionButton>
    </span>
  ) : (
    <ActionButton style={{ width: 'auto' }} onClick={() => setArmed(true)}>{label}</ActionButton>
  );
}

export function SchoolDataPanel() {
  const now = useNow();
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [consents, setConsents] = useState<IntegrationConsent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [said, setSaid] = useState('');

  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    void (async () => {
      const who = await signedIn();
      if (!who) return null;
      const [r, c] = await Promise.all([loadRecords(who.db), loadConsents(who.db)]);
      return { userId: who.userId, rows: r, consents: c };
    })().then(
      (got) => {
        if (!live || !got) return;
        setUserId(got.userId);
        setRows(got.rows);
        setConsents(got.consents);
      },
      () => { if (live) setSaid('Could not load what your school shared.'); },
    );
    return () => { live = false; };
  }, [version]);

  const mine = rows.filter((r) => r.subject_user_id === userId);
  const types = [...new Set(mine.map((r) => r.canonical_entity_type))];
  const live = consents.filter((c) => c.status === 'consented');
  if (types.length === 0 && live.length === 0 && !said) return null;

  return (
    <section className="school-data" aria-label="What your school shares with Semester">
      <SectionLabel>What your school shares with Semester</SectionLabel>
      <p className="school-data-lede">
        Only what your school approved and you consented to. Your school stays the official record for all of it.
      </p>
      <ul className="school-data-list">
        {types.map((t) => {
          const of = mine.filter((r) => r.canonical_entity_type === t);
          const worst = of.map((r) => effectiveFreshness(r, now))
            .sort((a, b) => ['live', 'recent', 'stale', 'estimated', 'manual', 'needs_confirmation', 'unavailable'].indexOf(b)
              - ['live', 'recent', 'stale', 'estimated', 'manual', 'needs_confirmation', 'unavailable'].indexOf(a))[0];
          return (
            <li key={t}>
              <strong>{PURPOSE[t]?.label ?? t}</strong> — {of.length} record{of.length === 1 ? '' : 's'} from {of[0].source_of_truth}.{' '}
              {PURPOSE[t]?.why} Freshness: {FRESHNESS_TEXT[worst]}.
              <TwoStep label="Delete these" confirm={`Delete ${of.length}`} onConfirm={async () => {
                const who = await signedIn();
                if (!who) return;
                try {
                  const gone = await forgetMine(who.db, who.userId, t);
                  setSaid(`Deleted ${gone}. They come back at the next sync unless you also revoke consent below.`);
                  refresh();
                } catch (e) { setSaid(e instanceof Error ? e.message : 'Could not delete those records.'); }
              }} />
            </li>
          );
        })}
      </ul>
      {live.length > 0 && (
        <ul className="school-data-list">
          {live.map((c) => (
            <li key={c.id}>
              Consent to read your records through a school connection, given {c.recorded_at.slice(0, 10)}.
              <TwoStep label="Revoke" confirm="Revoke consent" onConfirm={async () => {
                const who = await signedIn();
                if (!who) return;
                try {
                  await revokeConsent(who.db, c.id);
                  setSaid('Revoked. Nothing more about you will be read through that connection. What is already here stays until you delete it.');
                  refresh();
                } catch (e) { setSaid(e instanceof Error ? e.message : 'Could not revoke that consent.'); }
              }} />
            </li>
          ))}
        </ul>
      )}
      {said && <p role="status" className="school-data-lede">{said}</p>}
    </section>
  );
}
