import { useState } from 'react';
import { useStore } from '../../state/store';
import { Page } from '../../components/Page';
import { Blueprint } from '../../components/Blueprint';
import { ActionButton, SectionLabel } from '../../components/ui';
import { secondLine } from '../../lib/dim';
import { nameFor, whereFor } from '../../lib/call';
import { clock, dateToIso } from '../../lib/date';
import { shareLink } from './link';

/**
 * Booking a call, which is booking an appointment.
 *
 * There is no "scheduled calls" list anywhere in this app and there is not
 * going to be one. A call at four on Thursday is a thing at four on Thursday:
 * it belongs in the rail with your classes, on Today, in the week ahead, in
 * the export and in whatever you sync the calendar to — and every one of those
 * already knows how to draw an appointment. Adding a second kind of dated
 * thing would have meant teaching all of them about calls one screen at a
 * time, and missing one.
 *
 * So this writes an appointment whose `where` is the code. `codeOf` in
 * `lib/call.ts` reads it back, which is how the calendar knows to put a Join
 * button on one entry and not on the dentist.
 */
export function Schedule({
  code,
  onDone,
  onCancel,
}: {
  code: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { catalog, dispatch, now } = useStore();
  const [title, setTitle] = useState(nameFor(catalog.courses[0]?.code ?? ''));
  const [date, setDate] = useState(dateToIso(now));
  const [at, setAt] = useState(() => {
    // The next round half hour, which is when anybody booking a call means.
    const minutes = now.getHours() * 60 + now.getMinutes();
    return Math.min(23 * 60 + 30, Math.ceil((minutes + 15) / 30) * 30);
  });
  const [note, setNote] = useState('');

  return (
    <Page blurb="It goes in the calendar as an appointment, with the code on it and a way straight into the call.">
      <SectionLabel>What it is</SectionLabel>
      <input
        aria-label="What the call is"
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={nameFor('')}
        style={{ width: '100%' }}
      />

      <SectionLabel>When</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <input
          aria-label="Date of the call"
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <input
          aria-label="Time of the call"
          className="input"
          type="time"
          value={`${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`}
          onChange={(e) => {
            const [h, m] = e.target.value.split(':').map(Number);
            if (Number.isFinite(h) && Number.isFinite(m)) setAt(h * 60 + m);
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      <SectionLabel>Anything to say about it</SectionLabel>
      <textarea
        aria-label="Note on the call"
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Chapters 4 and 5, and the problem set"
        style={{ width: '100%', minHeight: 64, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
      />

      <SectionLabel>The link to send</SectionLabel>
      <Blueprint style={{ padding: 'var(--sp-6)' }}>
        <div style={{ fontSize: 'var(--type-md)', wordBreak: 'break-all', lineHeight: 'var(--leading-relaxed)' }}>
          {shareLink(code)}
        </div>
        <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
          The code is {code}. It is on the appointment, so it is still there on Thursday when
          somebody asks for it again.
        </div>
      </Blueprint>

      <ActionButton
        tone="primary"
        disabled={!title.trim() || !date}
        onClick={() => {
          dispatch({
            type: 'addAppointment',
            appointment: {
              title: title.trim(),
              kind: 'study',
              date,
              at,
              time: clock(at),
              where: whereFor(code),
              note: note.trim(),
            },
          });
          onDone();
        }}
        style={{ marginTop: 'var(--sp-7)' }}
      >
        Put it in the calendar
      </ActionButton>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={onCancel}
        style={{ height: 42, marginTop: 'var(--sp-5)' }}
      >
        Not now
      </button>
    </Page>
  );
}
