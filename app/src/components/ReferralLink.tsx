import { useEffect, useState } from 'react';
import { SectionLabel } from './ui';
import {
  ACTIVE_DAYS,
  linkFor,
  makeCode,
  standing,
  standingSaid,
  takeClaimSaid,
  type Standing,
} from '../lib/referral';

/**
 * A student's invite link, and the two numbers it has produced.
 *
 * It lives on the account screen and nowhere else, on purpose. The UI audit's
 * standing complaint about this app is that it has too many destinations, and
 * the plan this comes from says in as many words that a new feature should
 * land on a screen that already exists rather than add one. An invite link is
 * about the account — it does not exist signed out, and it is the only thing
 * here that is about other people — so this is the screen.
 *
 * ## Nothing is created until somebody asks
 *
 * Mounting reads the standing, which makes no row. The code itself is minted
 * by `make_referral_code()` when the button is pressed, so the great majority
 * of accounts — everybody who never wants to hand this to anyone — never get
 * one. That is also why there is a button here at all rather than a link that
 * is simply present: a row per account for a feature most accounts ignore is
 * a table that has to be reasoned about in every deletion and export path.
 *
 * ## What it refuses to show
 *
 * Who joined. `referral_standing()` cannot tell this component, by design —
 * the migration's header is the argument — so there is no list to draw and no
 * temptation to draw one. Two integers, and a sentence that is careful about
 * what they mean: "synced in the last N days" rather than "active", because
 * the app is usable signed out and a classmate happily using it on one device
 * is not counted. Saying "active" would overstate it in the direction somebody
 * eventually gets paid on.
 */
export function ReferralLink() {
  const [now, setNow] = useState<Standing | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  /*
   * The sentence owed to somebody who arrived on a link, read once and
   * cleared. It is here rather than in the claim itself because the claim
   * happens when a session appears — which is a moment with no screen of its
   * own, and may be in a different tab from the one the student is looking at.
   */
  const [arrived] = useState(takeClaimSaid);

  useEffect(() => {
    let dropped = false;
    void standing()
      .then((s) => {
        if (!dropped) setNow(s);
      })
      .catch((e: unknown) => {
        // Not an error card. This is the least important thing on the screen
        // and the account above it is working; a failed read leaves the
        // section absent rather than putting a red box under somebody's email
        // address.
        if (!dropped) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      dropped = true;
    };
  }, []);

  const link = now?.code ? linkFor(now.code) : '';

  const copy = () => {
    setNote('');
    void navigator.clipboard
      ?.writeText(link)
      .then(() => setNote('Link copied.'))
      // The same fallback the room link uses: show it, so it can be selected
      // by hand on the browsers that refuse the clipboard without a gesture
      // they recognise.
      .catch(() => setNote(link));
  };

  const make = () => {
    setBusy(true);
    setError('');
    void makeCode()
      .then((code) => setNow((s) => ({ ...(s ?? { joined: 0, active: 0, signupOpen: true }), code })))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  if (error || !now) return null;

  return (
    <>
      <SectionLabel>Invite a classmate</SectionLabel>

      {arrived && (
        <div
          role="status"
          style={{
            fontSize: 'var(--type-base)',
            color: 'var(--app-dim)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
            marginBottom: 'var(--sp-4)',
          }}
        >
          {arrived}
        </div>
      )}

      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        A link you can post in a group chat. Anyone who makes an account through it is counted
        here as a number — you never see who they are, and they are told that the count exists.
        Nothing about it changes what either of you can do in the app: there is no tier to unlock
        and nothing here is paid for.
      </div>

      {now.code ? (
        <>
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 'var(--type-sm)',
              marginTop: 'var(--sp-4)',
              padding: 'var(--sp-3)',
              borderRadius: 8,
              background: 'var(--app-panel)',
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {link}
          </div>
          <button type="button" className="btn btn-block" onClick={copy} style={{ marginTop: 'var(--sp-5)' }}>
            Copy link
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-block"
          disabled={busy}
          onClick={make}
          style={{ marginTop: 'var(--sp-4)' }}
        >
          {busy ? 'Making a link…' : 'Make my invite link'}
        </button>
      )}

      <div
        role="status"
        aria-live="polite"
        style={{
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          marginTop: 'var(--sp-4)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {note || (now.code ? standingSaid(now) : '')}
      </div>

      {now.code && now.signupOpen && (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-3)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {/* The caveat has to travel with the number. Semester works signed
              out, so somebody who joined on this link and uses it every day on
              one device counts as nought here. */}
          Counted from syncing, not from opening the app — a classmate using Semester signed out,
          or on one device, will not appear in the {ACTIVE_DAYS}-day figure.
        </div>
      )}
    </>
  );
}
