import { Blueprint } from '../components/Blueprint';
import type { Local } from '../lib/localask';
import type { Lists, Proposal } from '../lib/tools';
import type { Screen } from '../lib/types';

/**
 * What it offered, what it did, and what the app could say by itself.
 *
 * ## Nothing here has happened
 *
 * A proposal is a sentence the model wrote and a button the student has not
 * pressed. That is the whole safety model of this assistant — there is no
 * tool that acts, only tools that produce one of these — so the wording is
 * load-bearing: each line says what its button *will* change, in the future
 * tense, and the button is labelled with the change rather than with
 * "Confirm". A screen reader hearing "Confirm, button" learns nothing about
 * what is about to happen to their timetable.
 *
 * ## Why this is a component and not two
 *
 * These used to be written out inside the sheet, which meant the full chat
 * had no action cards at all: the model would propose adding a reminder,
 * `talk.proposals` would fill up, and the chat rendered none of it. Somebody
 * asking on the page rather than in the sheet got an answer describing an
 * offer with no way to accept it.
 */

export function Proposals({
  proposals,
  line,
  onRun,
  onDismiss,
}: {
  proposals: Proposal[];
  line: string;
  onRun: (p: Proposal) => void;
  onDismiss: (id: string) => void;
}) {
  if (proposals.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 'var(--sp-6)',
        padding: 'var(--sp-5) var(--sp-6)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-hero)',
      }}
    >
      <div className="kicker">{line}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
        {proposals.map((p) => (
          <div key={p.id} style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 'var(--type-sm)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              {p.said}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onRun(p)}
              // Named for the change, never "Confirm".
              aria-label={p.said}
              style={{ flex: 'none', height: 32, fontSize: 'var(--type-xs)' }}
            >
              {p.verb}
            </button>
            <button
              type="button"
              className="bare"
              aria-label={`Dismiss: ${p.said}`}
              onClick={() => onDismiss(p.id)}
              style={{ flex: 'none', width: 20, opacity: 0.4 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** What has been done, and how to take it back. */
export function Applied({
  applied,
  onTakeBack,
}: {
  applied: { p: Proposal; before: Lists }[];
  onTakeBack: (entry: { p: Proposal; before: Lists }) => void;
}) {
  if (applied.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
      {applied.map((e) => (
        <div key={e.p.id} style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 'var(--type-xs)',
              opacity: 0.75,
              lineHeight: 'var(--leading-normal)',
            }}
          >
            Done — {e.p.did}.
          </span>
          <button
            type="button"
            className="bare"
            onClick={() => onTakeBack(e)}
            aria-label={`Undo: ${e.p.did}`}
            style={{
              flex: 'none',
              width: 'auto',
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.1em',
              opacity: 0.7,
            }}
          >
            UNDO
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * What the app itself can say, with no request behind it.
 *
 * The screens whose own description matches the question, and lines lifted
 * from the guidebook. It says "with nothing sent" because that is the
 * interesting fact about it: this part of the answer is free, offline, and
 * cannot be wrong about the app in the way a model can.
 */
export function Locally({
  locally,
  onGo,
}: {
  locally: Local | null;
  onGo: (screen: Screen) => void;
}) {
  if (!locally) return null;
  return (
    <div style={{ marginTop: 'var(--sp-6)' }}>
      <div className="kicker">From this app, with nothing sent</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        {locally.matches.map((m) => (
          <Blueprint
            key={m.screen}
            onClick={() => onGo(m.screen)}
            style={{ padding: 'var(--sp-4) var(--sp-5)', textAlign: 'left' }}
          >
            <div style={{ fontSize: 'var(--type-sm)', fontFamily: 'var(--font-heading)' }}>
              {m.label}
              <span style={{ opacity: 0.45, fontFamily: 'var(--font-body)' }}> · {m.group}</span>
            </div>
            <div
              style={{
                fontSize: 'var(--type-xs)',
                opacity: 0.7,
                lineHeight: 'var(--leading-normal)',
                marginTop: 'var(--sp-1)',
              }}
            >
              {m.blurb}
            </div>
          </Blueprint>
        ))}
        {locally.fromGuide.map((quoted) => (
          <div
            key={quoted}
            style={{
              fontSize: 'var(--type-xs)',
              opacity: 0.7,
              lineHeight: 'var(--leading-relaxed)',
              paddingLeft: 'var(--sp-5)',
              borderLeft: '2px solid var(--app-line)',
            }}
          >
            {quoted}
          </div>
        ))}
      </div>
    </div>
  );
}
