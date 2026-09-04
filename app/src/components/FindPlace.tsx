/**
 * Looking an address up, for people who want that.
 *
 * The app has always taken the other route — you stand somewhere, tap, and
 * name it — and that route is not going anywhere: it is still the default and
 * it still sends nothing. This is the second one, for the addresses you cannot
 * stand in front of: an internship's office, a friend's flat, the building an
 * interview is in next Tuesday.
 *
 * ## It is off, and it says what turning it on does
 *
 * No request goes out until the switch is on, and the sentence next to the
 * switch names who receives what. Two switches, not one, because looking up
 * text you typed and sending the coordinates of where you are standing are
 * different acts and somebody may well want the first and not the second.
 *
 * ## It waits between requests because it was asked to
 *
 * Nominatim's usage policy asks for at most one request a second. That is a
 * policy rather than a rate limit — exceeding it gets an application blocked
 * rather than throttled — so the spacing lives in code, and there is nothing
 * in this UI that can issue a run of queries.
 */

import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Trouble } from './Trouble';
import { useTrouble } from '../lib/trouble';
import { SectionLabel } from './ui';
import { DEFAULT_RADIUS } from '../lib/place';
import {
  NEARBY,
  SERVICES,
  nothingLine,
  read,
  reverseUrl,
  searchUrl,
  waitFor,
  whatIsSent,
  type Found,
  type Near,
} from '../lib/geocode';

export function FindPlace() {
  const { state, dispatch } = useStore();
  const g = state.geocode;
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const lastAt = useRef(0);
  const abort = useRef<AbortController | null>(null);

  // The bias comes from a place the student has already saved — their own
  // coordinates, not a campus the app guessed at — so a student anywhere gets
  // the same help. No saved places, no bias, and the search still works.
  const near: Near | undefined = state.places[0]
    ? { lat: state.places[0].lat, lon: state.places[0].lon, span: NEARBY }
    : undefined;

  const call = async (url: string): Promise<unknown> => {
    const wait = waitFor(lastAt.current, Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt.current = Date.now();
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? 'The lookup service is asking for fewer requests. Wait a moment and try again.'
          : `The lookup service answered ${res.status}.`,
      );
    }
    return res.json();
  };

  const search = () => {
    if (!g.on || !query.trim()) return;
    setBusy(true);
    setHits(null);
    trouble.clear();
    call(searchUrl(g.service, query, near))
      .then((json) => setHits(read(g.service, json)))
      .catch((e) => trouble.failed(e, search))
      .finally(() => setBusy(false));
  };

  const whereAmI = () => {
    if (!g.on || !g.reverseOn) return;
    setBusy(true);
    setHits(null);
    trouble.clear();
    import('../lib/place')
      .then((m) => m.here())
      .then((fix) => call(reverseUrl(g.service, fix.lat, fix.lon)))
      .then((json) => setHits(read(g.service, json)))
      .catch((e) => trouble.failed(e, whereAmI))
      .finally(() => setBusy(false));
  };

  const service = SERVICES.find((s) => s.id === g.service) ?? SERVICES[0];

  return (
    <>
      <SectionLabel style={{ margin: '0 0 8px' }}>Look up an address</SectionLabel>

      {!g.on ? (
        <>
          <p
            style={{
              fontSize: 'calc(12.5px * var(--text-scale, 1))',
              opacity: 0.72,
              lineHeight: 1.55,
              textWrap: 'pretty',
            }}
          >
            Off. The app names places from coordinates you save yourself and sends nothing
            anywhere. Switching this on lets you search for an address instead —{' '}
            {whatIsSent(g.service, false)}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => dispatch({ type: 'setGeocode', patch: { on: true } })}
            style={{
              height: 44,
              marginTop: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
            }}
          >
            Turn address lookup on
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search();
              }}
              placeholder="2201 West End Ave, Nashville"
              aria-label="An address or a building to look up"
              style={{ flex: 1, height: 42 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={search}
              disabled={busy || !query.trim()}
              style={{
                width: 'auto',
                padding: '0 16px',
                height: 42,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
              }}
            >
              {busy ? '…' : 'Find'}
            </button>
          </div>

          <Trouble said={trouble.said} onRetry={trouble.again} busy={busy} />

          {hits !== null ? (
            hits.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11 }}>
                {hits.map((f) => (
                  <button
                    key={`${f.lat},${f.lon},${f.label}`}
                    type="button"
                    className="bare tappable"
                    onClick={() => {
                      dispatch({
                        type: 'addPlace',
                        place: {
                          label: f.name,
                          lat: f.lat,
                          lon: f.lon,
                          radius: DEFAULT_RADIUS,
                        },
                      });
                      setHits(null);
                      setQuery('');
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 13px',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--app-line)',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'calc(13.5px * var(--text-scale, 1))',
                        lineHeight: 1.35,
                        textWrap: 'pretty',
                      }}
                    >
                      {f.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'calc(11.5px * var(--text-scale, 1))',
                        opacity: 0.6,
                        marginTop: 3,
                        textWrap: 'pretty',
                      }}
                    >
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              /* A sentence, never a fallback pin: a pin dropped in the wrong
                 place is worse than no pin, because a pin is believed. */
              <p
                style={{
                  fontSize: 'calc(12.5px * var(--text-scale, 1))',
                  opacity: 0.7,
                  marginTop: 11,
                  lineHeight: 1.5,
                  textWrap: 'pretty',
                }}
              >
                {nothingLine(query)}
              </p>
            )
          ) : null}

          <SectionLabel style={{ margin: '22px 0 8px' }}>Settings</SectionLabel>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {SERVICES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="bare tappable"
                aria-pressed={g.service === s.id}
                onClick={() => dispatch({ type: 'setGeocode', patch: { service: s.id } })}
                style={{
                  width: 'auto',
                  padding: '8px 13px',
                  borderRadius: 'var(--r-sm)',
                  border: `1px solid ${g.service === s.id ? 'var(--app-accent)' : 'var(--app-line)'}`,
                  fontSize: 'calc(12px * var(--text-scale, 1))',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.6,
              marginTop: 8,
              lineHeight: 1.5,
              textWrap: 'pretty',
            }}
          >
            {service.label} is run by {service.who}. Neither needs an account or a key.{' '}
            {whatIsSent(g.service, false)}
          </p>

          {/* Its own switch. Looking up text you typed and sending where you
              are standing are different acts, and somebody may well want the
              first and not the second. */}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="bare tappable"
              aria-pressed={g.reverseOn}
              onClick={() => dispatch({ type: 'setGeocode', patch: { reverseOn: !g.reverseOn } })}
              style={{
                width: 'auto',
                padding: '8px 13px',
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${g.reverseOn ? 'var(--app-accent)' : 'var(--app-line)'}`,
                fontSize: 'calc(12px * var(--text-scale, 1))',
              }}
            >
              {g.reverseOn ? 'Naming where you are: on' : 'Also name where I am standing'}
            </button>
            <p
              style={{
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.6,
                marginTop: 8,
                lineHeight: 1.5,
                textWrap: 'pretty',
              }}
            >
              {whatIsSent(g.service, true)}
            </p>
            {g.reverseOn ? (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={whereAmI}
                disabled={busy}
                style={{
                  height: 42,
                  marginTop: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.09em',
                }}
              >
                What is here?
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="bare"
            onClick={() =>
              dispatch({ type: 'setGeocode', patch: { on: false, reverseOn: false } })
            }
            style={{
              width: 'auto',
              marginTop: 16,
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.5,
            }}
          >
            Turn it all off again
          </button>
        </>
      )}
    </>
  );
}
