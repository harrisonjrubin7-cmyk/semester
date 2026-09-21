import { useEffect, useMemo, useRef, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { ActionButton, SectionLabel } from './ui';
import { eventDays, type AthleticEvent } from '../lib/athletics';
import {
  coursesInDays,
  fetchPack,
  packFor,
  showBytes,
  type PackMiss,
} from '../lib/travelpack';
import { MEDIA_CAP } from '../lib/downloads';

/**
 * The course, on the phone, before the bus leaves.
 *
 * The Athletics screen already answers "what does this trip cost me" — the
 * classes in those days, the deadlines inside them. This is the half that
 * follows from the answer: the material for those courses, fetched while there
 * is still a connection, so the four hours on a bus are four hours of study
 * rather than four hours of a spinner.
 *
 * ## It is the existing offline promise, asked early
 *
 * Nothing here is a new cache. `public/sw.js` has kept audio, decks and
 * handouts since it was written; what it has never had is a way to be filled
 * on purpose, so everything in it arrived because somebody opened it while
 * they still had signal. `lib/travelpack.ts` fetches the same URLs a play
 * would, and the worker stores them under the same rules and the same cap.
 *
 * ## Which courses, and why not all of them
 *
 * The ones the trip runs over — a class in those days or a deadline inside
 * them. A student missing two of four classes does not want four courses of
 * audio on a phone, and the two it picks are the two already listed above it
 * under *what this runs over*, so the screen does not quietly mean something
 * different one section down.
 *
 * ## Nothing is promised that was not downloaded
 *
 * Every file comes back as landed or as a reason, and the reasons are shown.
 * A pack that quietly lost half its contents is how somebody boards a flight
 * with three of five readings and no idea which two are missing.
 */
export function TravelPack({ event }: { event: AthleticEvent }) {
  const { catalog, courseCode } = useStore();
  const now = useNow();

  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [missed, setMissed] = useState<PackMiss[]>([]);
  const stop = useRef<AbortController | null>(null);

  const files = useMemo(() => {
    const days = eventDays(event);
    return packFor(catalog, coursesInDays(catalog, days, now));
  }, [catalog, event, now]);

  // A run belongs to the event it was started for. Selecting another trip
  // while one is in flight would otherwise show the first one's count and
  // failures under the second one's name.
  useEffect(() => {
    return () => stop.current?.abort();
  }, [event.id]);

  const line = {
    fontSize: 'var(--type-sm)',
    ...secondLine(),
    lineHeight: 'var(--leading-normal)',
    textWrap: 'pretty',
  } as const;

  if (files.length === 0) {
    return (
      <>
        <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>Take it offline</SectionLabel>
        <p style={{ ...line, marginBlock: 0 }}>
          Nothing to bundle for these days. Either no course meets or falls due inside them, or the
          courses that do have no lessons, recordings or built files — an imported syllabus has none.
        </p>
      </>
    );
  }

  const courses = [...new Set(files.map((f) => f.course))];

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setSaid('');
    setMissed([]);
    setDone(0);
    stop.current = new AbortController();
    const out = await fetchPack(files, {
      onDone: (n) => setDone(n),
      signal: stop.current.signal,
    });
    setMissed(out.missed);
    setSaid(
      out.got.length === 0
        ? 'Nothing was downloaded. Check the connection and try again — anything already on this device is still there.'
        : `${out.got.length} of ${files.length} on this device, ${showBytes(out.bytes)}. They stay until you clear downloads under Settings, or until the ${showBytes(MEDIA_CAP)} cache is full and the oldest go.`,
    );
    setBusy(false);
  };

  return (
    <>
      <SectionLabel
        aside={`${files.length} ${files.length === 1 ? 'file' : 'files'}`}
        style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}
      >
        Take it offline
      </SectionLabel>
      <p style={{ ...line, marginBlock: 0 }}>
        Lessons, recordings and built files for {courses.map((c) => courseCode(c)).join(' and ')} — the
        courses these days run over. Downloaded now, on this connection, so they open on the way. Sizes
        are whatever the files are; audio is the large part.
      </p>

      <ul style={{ margin: 'var(--sp-4) 0 0', paddingLeft: 'var(--sp-7)' }}>
        {files.slice(0, 6).map((f) => (
          <li
            key={f.path}
            style={{
              fontSize: 'var(--type-sm)',
              ...secondLine(),
              lineHeight: 'var(--leading-normal)',
              paddingBlock: 'var(--sp-1)',
            }}
          >
            {courseCode(f.course)} · {f.label}
          </li>
        ))}
        {files.length > 6 && (
          <li
            style={{
              fontSize: 'var(--type-sm)',
              ...secondLine(),
              lineHeight: 'var(--leading-normal)',
              paddingBlock: 'var(--sp-1)',
            }}
          >
            and {files.length - 6} more
          </li>
        )}
      </ul>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <ActionButton onClick={() => void run()} disabled={busy} style={{ flex: '1 1 auto' }}>
          {busy ? `Downloading ${done} of ${files.length}…` : 'Download for this trip'}
        </ActionButton>
        {busy && (
          <ActionButton onClick={() => stop.current?.abort()} style={{ flex: '1 1 auto' }}>
            Stop
          </ActionButton>
        )}
      </div>

      {said && (
        <p
          role="status"
          style={{
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-normal)',
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {said}
        </p>
      )}

      {missed.length > 0 && (
        <>
          <p style={{ ...line, marginBlock: 'var(--sp-4) var(--sp-2)' }}>
            {missed.length} did not download. They are not on this device:
          </p>
          <ul style={{ margin: 0, paddingLeft: 'var(--sp-7)' }}>
            {missed.map((m) => (
              <li
                key={m.file.path}
                style={{
                  fontSize: 'var(--type-sm)',
                  ...secondLine(),
                  lineHeight: 'var(--leading-normal)',
                  paddingBlock: 'var(--sp-1)',
                }}
              >
                {courseCode(m.file.course)} · {m.file.label} — {m.why}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
