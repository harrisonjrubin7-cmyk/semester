import { useState } from 'react';
import { useStore } from '../../state/store';
import { Page } from '../../components/Page';
import { Blueprint } from '../../components/Blueprint';
import { SectionLabel } from '../../components/ui';
import { CallIcon, ChevronRight, Plus, ScreenShareIcon } from '../../components/Icons';
import { secondLine } from '../../lib/dim';
import { codeOf, nameFor, newCode, normaliseCode } from '../../lib/call';
import { isoToDate, longLabel } from '../../lib/date';
import { cloudConfigured } from '../../lib/cloud';
import { canShare, relayed, supported } from '../../lib/rtc';
import { Schedule } from './Schedule';

/**
 * The four things, and what is already in the diary.
 *
 * Zoom's home screen is four buttons and nothing else, and it is the right
 * shape: everything anybody opens a call app to do is one of start one, join
 * one, book one, or show somebody something. The mistake would be to copy the
 * four and stop there, because this app knows something Zoom does not — which
 * courses you are taking, and what is due in them. So the four sit above your
 * courses, and starting a call from a course names it after that course, which
 * is the whole difference between a call in a semester app and a call.
 */
export function Lobby({
  onOpen,
}: {
  onOpen: (call: { code: string; title: string; share?: boolean }) => void;
}) {
  const { state, catalog, now } = useStore();
  const [typed, setTyped] = useState('');
  const [booking, setBooking] = useState('');

  const joinable = normaliseCode(typed);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const booked = state.appointments
    .filter((a) => codeOf(a) && isoToDate(a.date) >= today)
    .sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1))
    .slice(0, 6);

  if (booking) {
    return (
      <Schedule
        code={booking}
        onDone={() => setBooking('')}
        onCancel={() => setBooking('')}
      />
    );
  }

  return (
    <Page
      blurb="A call runs between the browsers in it, with nothing in the middle holding the video. Start one and send the link, or type a code somebody sent you."
      bottom={26}
    >
      {!supported() && (
        <Blueprint style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)', marginBottom: 'var(--sp-6)' }}>
          <div className="kicker">This browser cannot do calls</div>
          <div style={{ fontSize: 'var(--type-base)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)', ...secondLine() }}>
            It has no camera API. Everything else in the app works here; a call needs a recent
            Safari, Chrome or Firefox.
          </div>
        </Blueprint>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
        <Big
          label="New call"
          note="Start one now"
          icon={<Plus size={22} />}
          accent
          onClick={() => onOpen({ code: newCode(), title: nameFor('') })}
        />
        <Big
          label="Share screen"
          note={canShare() ? 'Start one, sharing' : 'Not on this device'}
          icon={<ScreenShareIcon size={22} />}
          disabled={!canShare()}
          onClick={() => onOpen({ code: newCode(), title: nameFor(''), share: true })}
        />
      </div>

      <SectionLabel>Join with a code</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <input
          aria-label="Call code or link"
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && joinable) onOpen({ code: joinable, title: '' });
          }}
          placeholder="bcd-fghj-kmn, or the link"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!joinable}
          onClick={() => onOpen({ code: joinable, title: '' })}
          style={{ flex: 'none', paddingInline: 'var(--sp-7)', height: 44 }}
        >
          Join
        </button>
      </div>
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
        The whole link works too — paste it and the code is taken out of it.
      </div>

      <SectionLabel>Start one for a course</SectionLabel>
      {catalog.courses.length === 0 ? (
        <div style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-relaxed)' }}>
          No courses yet — a call still works without one, it just gets a plainer name.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
          {catalog.courses.map((c) => (
            <button
              key={c.id}
              type="button"
              className="btn btn-secondary"
              onClick={() => onOpen({ code: newCode(), title: nameFor(c.code) })}
              style={{ height: 38, paddingInline: 'var(--sp-6)', fontSize: 'var(--type-sm)', width: 'auto' }}
            >
              {c.code}
            </button>
          ))}
        </div>
      )}

      <SectionLabel>Booked</SectionLabel>
      {booked.length === 0 ? (
        <div style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-relaxed)' }}>
          Nothing booked. A scheduled call is an ordinary appointment — it lands in the calendar,
          on Today and in the week ahead, with a Join button on it.
        </div>
      ) : (
        booked.map((a) => (
          <button
            key={a.id}
            type="button"
            className="bare tappable"
            onClick={() => onOpen({ code: codeOf(a), title: a.title })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-5)',
              width: '100%',
              textAlign: 'left',
              paddingBlock: 'var(--sp-6)',
              borderBottom: '1px solid var(--app-line)',
            }}
          >
            <CallIcon size={17} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{a.title}</span>
              <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-1)' }}>
                {longLabel(isoToDate(a.date))} · {a.time} · {codeOf(a)}
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        ))
      )}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => setBooking(newCode())}
        style={{ height: 44, marginTop: 'var(--sp-6)' }}
      >
        Schedule a call
      </button>

      <SectionLabel>What this needs</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-relaxed)' }}>
        {cloudConfigured
          ? 'Two browsers cannot introduce themselves unaided, so the offer and the answer go through the account service this build is configured with. The video does not: it goes straight between the people in the call.'
          : 'This build has no account service configured, so there is nothing to carry the introduction between two browsers and nobody else can join. The green room still works — camera, microphone, and a check that both are the ones you meant.'}
        {' '}
        {relayed
          ? 'A relay is configured, so a network that refuses a direct connection still works.'
          : 'No relay is configured, so a network that refuses direct connections — some campus and hotel networks do — will not carry a call. SETUP.md says how to add one.'}
      </div>

      {/*
        The one thing to say about a code, said once, here rather than on a
        tooltip: it is a name, not a password.
      */}
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        Anybody holding the code can walk into the call. Send it to the people you want in it, and
        start a new one if it gets out. {state.courses.length > 0 ? 'Nothing about your semester is shared by being in a call.' : ''}
      </div>
    </Page>
  );
}

/** One of the two big actions at the top. Zoom's home, in this app's frame. */
function Big({
  label,
  note,
  icon,
  onClick,
  accent = false,
  disabled = false,
}: {
  label: string;
  note: string;
  icon: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <Blueprint
      as="button"
      onClick={disabled ? undefined : onClick}
      style={{
        padding: 'var(--sp-7)',
        textAlign: 'left',
        display: 'block',
        width: '100%',
        background: accent ? 'var(--app-hero)' : undefined,
        opacity: disabled ? 'var(--app-row-dim)' : undefined,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span style={{ display: 'block', color: 'var(--app-accent)' }}>{icon}</span>
      <span style={{ display: 'block', fontSize: 'var(--type-lg)', marginTop: 'var(--sp-5)' }}>{label}</span>
      <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-1)' }}>
        {note}
      </span>
    </Blueprint>
  );
}
