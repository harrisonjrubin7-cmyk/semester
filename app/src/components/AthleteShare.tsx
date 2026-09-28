import { dateToIso } from '../lib/date';
import { useEffect, useState } from 'react';
import type { AthleticsLibrary } from '../lib/athletics';
import {
  NOT_RECORDED,
  OFFERED,
  listSupportShares,
  mySupportShares,
  readSupportShare,
  revokeSupportShare,
  shareWithSupport,
  supportPayload,
  supportProblems,
  type MySupportShare,
  type SupportListing,
  type SupportPayload,
} from '../lib/athleteshare';
import { cloudConfigured } from '../lib/cloud';
import { localMinute } from '../lib/familyshare';
import { ATHLETE_NEVER_SHARED, ATHLETE_SHAREABLE, SHARE_MAX_DAYS, type AthleteShareable } from '../lib/sharing';
import { useNow, useStore } from '../state/store';
import { SectionLabel } from './ui';

/**
 * What the recipient sees, and what the athlete previews: one component, so
 * the preview cannot say something the page does not.
 */
export function SupportPayloadView({ payload }: { payload: SupportPayload }) {
  const none = <p className="sharing-meta">Nothing in this for the dates shared.</p>;
  return (
    <div className="support-payload">
      {payload.travel && (
        <section aria-label="Travel and competition dates">
          <h4>Travel and competition dates</h4>
          {payload.travel.length === 0 ? none : (
            <ul className="sharing-list">
              {payload.travel.map((t) => (
                <li key={`${t.title}${t.from}`}>
                  <strong>{t.title}</strong>
                  <div className="sharing-meta">
                    {t.kind} · {t.from === t.to ? t.from : `${t.from} to ${t.to}`}
                    {t.misses.length ? ` · misses ${t.misses.join(', ')}` : ' · no classes missed'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {payload.missed && (
        <section aria-label="Missed classes">
          <h4>Missed classes</h4>
          {payload.missed.length === 0 ? none : (
            <ul className="sharing-list">
              {payload.missed.map((m) => (
                <li key={m.course}>
                  <strong>{m.course}</strong>
                  <div className="sharing-meta">{m.classes.join('; ')}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {payload.courses && (
        <section aria-label="Courses this term">
          <h4>Courses this term</h4>
          {payload.courses.length === 0 ? none : (
            <ul className="sharing-list">
              {payload.courses.map((c) => (
                <li key={c.code}>
                  <strong>{c.code}</strong> {c.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {payload.deadlines && (
        <section aria-label="Deadlines during travel">
          <h4>Deadlines during travel</h4>
          {payload.deadlines.length === 0 ? none : (
            <ul className="sharing-list">
              {payload.deadlines.map((d) => (
                <li key={`${d.course}${d.title}${d.due}`}>
                  <strong>{d.course}</strong> {d.title}
                  <div className="sharing-meta">
                    Due {d.due} · {d.source}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

const inDays = (today: string, n: number) => {
  const d = new Date(`${today}T12:00`);
  d.setDate(d.getDate() + n);
  return dateToIso(d);
};

/**
 * The athlete's side: choose, preview, confirm, and then see each time it is
 * opened and stop it. Nothing is sent until the preview is confirmed, and
 * nothing is sent anywhere but to the one person named.
 */
export function AthleteShare({ library, today = dateToIso(new Date()) }: { library: AthleticsLibrary; today?: string }) {
  const { account, catalog } = useStore();
  const now = useNow();
  const [chosen, setChosen] = useState<AthleteShareable[]>([]);
  const [email, setEmail] = useState('');
  const [sharedAs, setSharedAs] = useState('');
  const [ends, setEnds] = useState('');
  const [step, setStep] = useState<'choose' | 'preview'>('choose');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [mine, setMine] = useState<MySupportShare[]>([]);
  const signedIn = cloudConfigured && !!account;

  const refresh = () => {
    if (signedIn) void mySupportShares().then(setMine, () => setMine([]));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [signedIn]);

  if (!signedIn) {
    return (
      <section aria-labelledby="athlete-share-title" className="family-invite">
        <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>
          <span id="athlete-share-title">Share with academic support</span>
        </SectionLabel>
        <p className="sharing-lead">Sharing with athletic academic support needs you signed in. Nothing here leaves this device until then.</p>
      </section>
    );
  }

  const problems = supportProblems(chosen, sharedAs, email, ends, today);
  const payload = supportPayload(chosen, sharedAs, library, catalog, today, ends || today, now);
  const toggle = (k: AthleteShareable) => setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  return (
    <section aria-labelledby="athlete-share-title" className="family-invite">
      <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>
        <span id="athlete-share-title">Share with academic support</span>
      </SectionLabel>
      <p className="sharing-lead">
        With one person in your school’s athletic academic support office, for what you choose, until the date you set.
        They see a copy of it as it is now, and you see every time they open it. The compliance office cannot receive it.
      </p>

      {step === 'choose' ? (
        <>
          <fieldset className="support-choose">
            <legend className="sharing-meta">What to share</legend>
            {ATHLETE_SHAREABLE.map(([k, text]) => (
              <label key={k} className="support-option">
                <input type="checkbox" checked={chosen.includes(k)} disabled={!OFFERED.includes(k)} onChange={() => toggle(k)} />
                <span>
                  {text}
                  {NOT_RECORDED[k] && <span className="sharing-meta support-why">{NOT_RECORDED[k]}</span>}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="sharing-meta">Never shared, whatever you choose:</p>
          <ul className="sharing-problems">
            {ATHLETE_NEVER_SHARED.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <label className="family-claim">
            <span className="sharing-meta">Their Semester address</span>
            <input className="input" type="email" value={email} maxLength={254} autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="family-claim">
            <span className="sharing-meta">Your name, as they will see it</span>
            <input className="input" value={sharedAs} maxLength={80} autoComplete="given-name" onChange={(e) => setSharedAs(e.target.value)} />
          </label>
          <label className="family-claim">
            <span className="sharing-meta">Until (at most {SHARE_MAX_DAYS} days)</span>
            <input className="input" type="date" value={ends} min={today} max={inDays(today, SHARE_MAX_DAYS)} onChange={(e) => setEnds(e.target.value)} />
          </label>
          {problems.length > 0 && (
            <ul className="sharing-problems" aria-label="Before this can be shared" aria-live="polite">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-secondary" disabled={problems.length > 0} onClick={() => setStep('preview')}>
            Preview what they will see
          </button>
        </>
      ) : (
        <div className="family-confirm">
          <p>
            Share this with <strong>{email.trim()}</strong> until <strong>{ends}</strong>, as <strong>{sharedAs.trim()}</strong>?
          </p>
          <SupportPayloadView payload={payload} />
          <ul className="sharing-problems">
            <li>This is exactly what they will see. A later change reaches them only if you share again.</li>
            <li>It stops by itself if they leave athletic academic support, or on the date above.</li>
            <li>Anything shared can be copied by the person who sees it.</li>
          </ul>
          <div className="portal-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setSaid('');
                try {
                  await shareWithSupport(email, payload, ends, today);
                  setSaid(`Shared. ${email.trim()} can open it until ${ends}.`);
                  setStep('choose');
                  setChosen([]);
                  refresh();
                } catch (e) {
                  setSaid(`Not shared: ${(e as Error).message}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Share it
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep('choose')}>
              Back
            </button>
          </div>
        </div>
      )}
      {said && <p role="status" className="sharing-lead">{said}</p>}

      {mine.length > 0 && (
        <>
          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>Your shares</SectionLabel>
          <ul className="sharing-list">
            {mine.map((s) => {
              const live = !s.revokedAt && s.expiresAt > new Date().toISOString();
              return (
                <li key={s.id}>
                  <strong>Shared {s.createdAt.slice(0, 10)}</strong>
                  <div className="sharing-meta">
                    {s.revokedAt ? 'Stopped' : live ? `Until ${s.expiresAt.slice(0, 10)}` : 'Ended'} ·{' '}
                    {s.reads.length === 0 ? 'not opened yet' : `opened ${s.reads.length} ${s.reads.length === 1 ? 'time' : 'times'}, last ${localMinute(s.reads[0])}`}
                  </div>
                  {live && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void revokeSupportShare(s.id).then(refresh, (e: Error) => setSaid(`Could not stop it: ${e.message}`))}
                    >
                      Stop this share
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * The staff side: what athletes have shared with you. Listing names and dates
 * is not logged; opening one is, and says so on the button.
 */
export function SupportSharesWithYou() {
  const { account } = useStore();
  const [list, setList] = useState<SupportListing[]>([]);
  const [open, setOpen] = useState<{ id: string; payload: SupportPayload } | null>(null);
  const [said, setSaid] = useState('');
  const signedIn = cloudConfigured && !!account;

  useEffect(() => {
    if (signedIn) void listSupportShares().then(setList, () => setList([]));
  }, [signedIn]);

  if (!signedIn || (list.length === 0 && !said)) return null;

  return (
    <section aria-labelledby="support-with-you-title" className="family-invite">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="support-with-you-title">Shared with you by athletes</span>
      </SectionLabel>
      <p className="sharing-lead">Read only. Each athlete sees every time you open theirs.</p>
      <ul className="sharing-list">
        {list.map((s) => (
          <li key={s.id}>
            <strong>{s.sharedAs || 'An athlete'}</strong>
            <div className="sharing-meta">Until {s.expiresAt.slice(0, 10)}</div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                setSaid('');
                try {
                  setOpen({ id: s.id, payload: await readSupportShare(s.id) });
                } catch {
                  // D3: ended by revocation, by date or by a lost role — one sentence.
                  setOpen(null);
                  setList((l) => l.filter((x) => x.id !== s.id));
                  setSaid('This share has ended.');
                }
              }}
            >
              Open {s.sharedAs || 'this share'}
            </button>
            {open?.id === s.id && <SupportPayloadView payload={open.payload} />}
          </li>
        ))}
      </ul>
      {said && <p role="status" className="sharing-lead">{said}</p>}
    </section>
  );
}
