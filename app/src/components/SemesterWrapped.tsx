import { useMemo, useState } from 'react';
import { ACTIONS_PREFIX, EMPTY_ACTION_CHOICES, readActionChoices } from '../lib/actions';
import { EMPTY_MEETINGS, meetingKey, readMeetings } from '../lib/advisor-meeting';
import { EMPTY_CAREER, readCareer } from '../lib/career';
import { EMPTY_EVIDENCE, readEvidence } from '../lib/career-evidence';
import { download } from '../lib/deliver';
import { useDeviceLibrary } from '../lib/device-library';
import { EMPTY_REGISTRATION, readRegistration } from '../lib/portal-storage';
import { REGISTRATION_KEY } from '../lib/registration-plan';
import { readTerm, termsAround } from '../lib/term';
import { schedulesFor, wrapped, wrappedText } from '../lib/wrapped';
import { useNow, useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';

type Out = 'text' | 'image' | 'share';

/** Draws the recap text onto a canvas, or returns null where there is no canvas. */
async function imageOf(text: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const lines = text.split('\n');
  canvas.width = 1080;
  canvas.height = 160 + lines.length * 56;
  const g = canvas.getContext?.('2d');
  if (!g) return null;
  g.fillStyle = '#12141a';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#eceef2';
  lines.forEach((line, i) => {
    g.font = i === 0 ? '600 44px system-ui, sans-serif' : '32px system-ui, sans-serif';
    g.fillText(line, 80, 110 + i * 56);
  });
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Semester Wrapped (`semester_wrapped`, Phase L), on Me.
 *
 * A private recap of one term, worked out on this device from the student's
 * own records every time it is shown — nothing is stored, nothing is sent.
 * Export, image and share each show exactly the text first and go only where
 * the student sends them. See `lib/wrapped.ts` for what is counted and what
 * never is.
 */
export function SemesterWrapped() {
  const { state, account, dispatch } = useStore();
  const now = useNow();
  const who = account?.id || 'device';
  const choices = useMemo(() => termsAround(now, 2, 0).reverse(), [now]);
  const [termId, setTermId] = useState(state.term || choices[0].id);
  const term = readTerm(termId);

  const registration = useDeviceLibrary(REGISTRATION_KEY, readRegistration, EMPTY_REGISTRATION).value;
  const meetings = useDeviceLibrary(meetingKey(account?.id), readMeetings, EMPTY_MEETINGS).value.meetings;
  const evidence = useDeviceLibrary(`semester.career-evidence.v1:${who}:${term.id}`, readEvidence, EMPTY_EVIDENCE).value;
  const career = useDeviceLibrary(`semester.career.v1:${who}:${term.id}`, readCareer, EMPTY_CAREER).value;
  const actions = useDeviceLibrary(`${ACTIONS_PREFIX}:${who}`, readActionChoices, EMPTY_ACTION_CHOICES).value.choices;

  const w = useMemo(
    () =>
      wrapped({
        term,
        done: state.done,
        tickedAt: state.tickedAt,
        sessions: state.sessions,
        taken: state.taken,
        schedulesSaved: schedulesFor(registration.plans, term),
        meetings,
        artifacts: evidence.artifacts,
        bullets: evidence.bullets,
        eventsSaved: career.opportunities.filter((o) => o.saved && o.kind === 'Career event').length,
        actionChoices: actions,
      }),
    [term, state.done, state.tickedAt, state.sessions, state.taken, registration.plans, meetings, evidence, career.opportunities, actions],
  );
  const text = wrappedText(w);
  const [confirm, setConfirm] = useState<Out | null>(null);
  const [said, setSaid] = useState('');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const send = async (out: Out) => {
    const name = `${w.title}`;
    if (out === 'text') {
      download({ name: `${name}.txt`, body: text, mime: 'text/plain' });
      setSaid('Saved as a text file on this device.');
    } else if (out === 'image') {
      const blob = await imageOf(text);
      if (!blob) {
        setSaid('This browser cannot make an image. Save it as text instead.');
        return;
      }
      download({ name: `${name}.png`, body: blob, mime: 'image/png' });
      setSaid('Saved as an image on this device.');
    } else {
      try {
        await navigator.share({ title: w.title, text });
        setSaid('Shared.');
      } catch {
        setSaid('Not shared.');
      }
    }
  };

  const WHERE: Record<Out, string> = {
    text: 'Saved as a text file on this device. Nothing is sent anywhere.',
    image: 'Saved as a picture of exactly this text on this device. Nothing is sent anywhere.',
    share: 'Opens your device’s share sheet with exactly this text. You choose where it goes, or cancel.',
  };

  return (
    <section className="portal-panel wrapped" aria-label={w.title}>
      <p className="portal-eyebrow">Private to you</p>
      <h3>{w.title}</h3>
      <label className="office-field wrapped-term">
        <span>Term</span>
        <select aria-label="Term" value={term.id} onChange={(ev) => setTermId(ev.target.value)}>
          {choices.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <p className="portal-muted">
        {w.span}. Made on this device from your own records — what you planned, finished and wrote. Not from how often you
        opened the app, and nothing from your school.
      </p>

      {w.empty ? (
        <p>A quiet term in Semester. That is fine — there is nothing here to measure you by.</p>
      ) : (
        <>
          {w.made.length ? (
            <ul className="wrapped-list">
              {w.made.map((l) => (
                <li key={l.key}>{l.text}</li>
              ))}
            </ul>
          ) : null}
          {w.forward.length ? (
            <>
              <p className="wrapped-sub">You moved forward by:</p>
              <ul className="wrapped-list">
                {w.forward.map((l) => (
                  <li key={l.key}>{l.text}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}

      {said ? <p role="status" className="balance-said">{said}</p> : null}
      <div className="office-buttons">
        <button type="button" className="balance-button" onClick={() => dispatch({ type: 'go', screen: 'yes' })}>
          Plan {w.next.label}
        </button>
        <button type="button" className="balance-button" onClick={() => setConfirm('text')}>
          Export my progress…
        </button>
        <button type="button" className="balance-button" onClick={() => setConfirm('image')}>
          Save as image…
        </button>
        {canShare ? (
          <button type="button" className="balance-button" onClick={() => setConfirm('share')}>
            Share…
          </button>
        ) : null}
      </div>

      {confirm ? (
        <ConfirmDialog
          title={confirm === 'share' ? 'Share your recap?' : confirm === 'image' ? 'Save your recap as an image?' : 'Export your recap?'}
          preview={
            <>
              <pre className="wrapped-preview">{text}</pre>
              <p>{WHERE[confirm]}</p>
              <p>No name, course titles or dates beyond the term are in it.</p>
            </>
          }
          confirmLabel={confirm === 'share' ? 'Share' : 'Save'}
          onConfirm={() => {
            const out = confirm;
            setConfirm(null);
            void send(out);
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}
