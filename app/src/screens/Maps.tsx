import { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useRowStyle } from '../components/shell/useShell';
import { Page } from '../components/Page';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { Blueprint } from '../components/Blueprint';
import type { Pin } from '../components/LiveMap';
import { ActionButton, ChipRow, SectionLabel, Segmented } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { blocksFor, codeOf } from '../data/catalog';
import { minutesNow } from '../lib/date';
import { nextClass } from '../lib/select';
import type { Block } from '../lib/types';
import {
  CENTRES,
  findPlaces,
  type Found,
  type Scope,
} from '../lib/findplace';
import {
  DEFAULT_RADIUS,
  explainPlaceError,
  far,
  here,
  locationSupported,
  metresBetween,
  placeAt,
  type Fix,
} from '../lib/place';
import {
  foundStop,
  leaving,
  matchStops,
  nearestFirst,
  reach,
  roomStop,
  savedStop,
  type Reach,
  type Stop,
} from '../lib/arrive';
import { FindPlace } from '../components/FindPlace';
import { FillPlaces } from '../components/FillPlaces';
import { unplaced } from '../lib/locate';
import {
  CAMPUS_MAP,
  CITY_MAP,
  TRAVEL,
  appleMapsUrl,
  directionsUrl,
  fromRoom,
  isPlace,
  prefersApple,
  type Travel,
} from '../lib/maps';

/**
 * Leaflet and its stylesheet are about 150kB, and most sessions never open
 * this screen. Split out, they are fetched the first time somebody looks at a
 * map rather than on every cold start of the app.
 */
const LiveMap = lazy(() =>
  import('../components/LiveMap').then((m) => ({ default: m.LiveMap })),
);

const SHORT = 300;
const TALL = 470;

/**
 * Metres inside which two coordinates are the same place.
 *
 * Thirty: wider than the twenty-odd a phone knows itself to, narrower than the
 * gap between two neighbouring buildings on a quad.
 */
const SAME = 30;

/**
 * Getting there.
 *
 * The map is a real one — pannable, searchable, drawn from OpenStreetMap —
 * and it exists because OSM asks for attribution where Google asks for an API
 * key, which would mean a billing account and a credential in the page of an
 * app anyone can view-source.
 *
 * ## What changed, and why
 *
 * This screen used to be a map with five lists stacked under it, each row a
 * link straight out to Google Maps. It answered "where is Buttrick" and
 * nothing else, and everything on it was a separate thing: a list of classes
 * that could not be drawn on the map above it, a travel-mode picker three
 * sections away from the links it governed, and a map whose pins were not the
 * rows and whose rows were not the pins.
 *
 * Three changes, all of them the same change:
 *
 *  1. **One kind of thing.** A class, a room, a place you saved and a search
 *     result are all a {@link Stop} now. The map draws stops, the lists list
 *     stops, and tapping either — a pin or a row — selects the same one. What
 *     you do with it is in one panel, next to the thing it acts on, instead of
 *     spread down the screen.
 *
 *  2. **Time, not just place.** The app knows when your next class starts and
 *     which building it is in. Given somewhere to measure from it can say the
 *     only thing anybody actually wants at 8:52: *leave now*, or *you have
 *     eleven minutes*. That is the banner at the top and it is the reason this
 *     screen is worth opening rather than the phone's own map app.
 *
 *  3. **Rooms can become places.** The app used to learn a coordinate only by
 *     you standing in the building and tapping save, which is a fine way to
 *     record home and a terrible way to learn the eight buildings you are
 *     taught in. Every room now has a "find it" that searches for the building
 *     and offers to keep it. Once kept it is a real coordinate everywhere —
 *     the distances here, the walk between two classes on Today, the pin on
 *     this map.
 *
 * Routing is still handed to the phone's own map app. Turn-by-turn is a hard
 * problem four companies have solved, on a device that talks and works with
 * the screen off; looking at a map and being guided along a route are
 * different jobs and the app is only better at the first one.
 */
export function Maps() {
  const { state, dispatch, now, catalog } = useStore();
  // A row's padding and hairline, from the layout rather than hard-coded.
  const linkRow = useRowStyle(13);
  const [mode, setMode] = useState<Travel>('walking');
  const [scope, setScope] = useState<Scope>('campus');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [you, setYou] = useState<Fix | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  // Two name fields, and they are not the same one. The panel's names a place
  // the app found; the card below the map names the ground you are standing
  // on. Sharing one piece of state put "Alumni Hall" into the box asking what
  // to call where you are — an offer to save a coordinate under the name of a
  // building three hundred metres away.
  const [naming, setNaming] = useState('');
  const [standing, setStanding] = useState('');
  const [tall, setTall] = useState(false);
  const [fit, setFit] = useState(0);
  const [centre, setCentre] = useState(CENTRES.campus);
  const [zoom, setZoom] = useState(CENTRES.campus.zoom);
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);
  const apple = prefersApple();
  const places = state.places;
  const minutes = minutesNow(now);
  const spot = you ? { lat: you.lat, lon: you.lon } : null;

  /**
   * The room a block is in.
   *
   * A block's `meta` is written for a person — "Garland 162 · Prof.
   * Trounstine" — so only the part before the middle dot can be a room, the
   * same split `lib/rooms.ts` makes. It is asked first because that is where a
   * day's room change lives, and the course's own room stands in when what is
   * there is not a place at all: ECON's `meta` reads "Section 9:05 · Dr.
   * Stromme", and a class whose syllabus named no room ends up with no stop
   * rather than with directions to a section number. See `isPlace` — a wrong
   * place is worse than none, because a wrong one is followed.
   */
  const roomOf = (b: Block): string => {
    const written = b.meta.split('\u00b7')[0].trim();
    if (isPlace(written)) return written;
    const course = b.c ? catalog.byId[b.c] : null;
    return course && isPlace(course.room) ? course.room : '';
  };

  const stopFor = (
    key: string,
    kind: Stop['kind'],
    label: string,
    room: string,
    extra: Partial<Stop> = {},
  ): Stop[] => {
    const dest = fromRoom(room);
    return dest ? [roomStop(key, kind, label, room, dest, places, extra)] : [];
  };

  const today: Stop[] = blocksFor(catalog, now)
    .filter((b) => !b.canceled)
    .flatMap((b, i) =>
      stopFor(
        `class-${b.at}-${i}`,
        'class',
        b.c ? codeOf(catalog, b.c) : b.title,
        roomOf(b),
        { at: b.at, time: b.time },
      ),
    );

  const rooms: Stop[] = catalog.courses.flatMap((c) =>
    stopFor(`room-${c.id}`, 'room', c.code, c.room),
  );
  const saved: Stop[] = places.map(savedStop);
  const found: Stop[] = hits.map(foundStop);
  const everything = [...today, ...saved, ...rooms, ...found];

  /**
   * What the map is currently drawing, as a string.
   *
   * The stop lists are rebuilt every render, so memoising the pins against
   * them would memoise nothing and Leaflet would tear down and redraw every
   * marker on every keystroke — closing a popup somebody had open. Memoising
   * against a signature of what is actually drawn redraws exactly when what
   * is drawn has changed.
   */
  const drawn = JSON.stringify([
    [...today, ...saved, ...found].map((s) => [s.key, s.label, s.spot?.lat, s.spot?.lon]),
    you && [you.lat, you.lon, you.accuracy],
  ]);

  const picked = everything.find((s) => s.key === pickedKey) ?? null;
  const pickedReach: Reach | null = spot && picked?.spot ? reach(spot, picked.spot) : null;

  /**
   * The saved place this selection *is*, by position rather than by name.
   *
   * A room knows the place it matched; a search result does not, and would go
   * on offering to save a building you saved thirty seconds ago — a second
   * copy of the same coordinate under a slightly different spelling. Anything
   * within {@link SAME} metres of a place you already have is that place.
   */
  const held = picked?.spot
    ? (places.find((p) => p.id === picked.placeId) ??
      places.find((p) => metresBetween(p, picked.spot as { lat: number; lon: number }) < SAME))
    : undefined;

  /** Select a stop, and move the map to it when there is somewhere to move to. */
  const pick = (stop: Stop) => {
    setPickedKey(stop.key);
    setNaming(stop.kind === 'found' || stop.kind === 'class' || stop.kind === 'room' ? stop.building : '');
    if (stop.spot) {
      setCentre({ lat: stop.spot.lat, lon: stop.spot.lon, zoom: 17 });
      setZoom(17);
    }
  };

  // Only things with real coordinates can be drawn. A room name is a search
  // string, not a position, and plotting a guess would be worse than nothing.
  // A room that resolved to a place you saved is already on the map as that
  // place, so rooms draw no pin of their own.
  const pins: Pin[] = useMemo(() => {
    const list: Pin[] = [];
    const at = new Set<string>();
    const put = (stop: Stop, tone: Pin['tone'], badge?: string) => {
      if (!stop.spot) return;
      const key = `${stop.spot.lat.toFixed(5)},${stop.spot.lon.toFixed(5)}`;
      if (at.has(key)) return;
      at.add(key);
      list.push({
        id: stop.key,
        lat: stop.spot.lat,
        lon: stop.spot.lon,
        label: stop.label,
        tone,
        badge,
        onOpen: () => pick(stop),
      });
    };
    today.forEach((stop, i) => put(stop, 'class', String(i + 1)));
    for (const stop of saved) put(stop, 'saved');
    for (const stop of found) put(stop, 'result');
    if (you) {
      list.push({
        id: 'you',
        lat: you.lat,
        lon: you.lon,
        label: 'You are here',
        tone: 'you',
        spread: you.accuracy,
      });
    }
    return list;
    // Everything drawn is inside `drawn`; the lists it reads are rebuilt each
    // render and would defeat the memo if they were listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn]);

  /**
   * Which pin the selection is, which is not always the selected stop's own.
   *
   * Two classes in Garland draw one pin between them, so selecting the second
   * would highlight nothing if the map were handed a key it never drew.
   * Matched on position, which is what a pin actually is.
   */
  const shown = picked?.spot
    ? (pins.find(
        (p) =>
          Math.abs(p.lat - (picked.spot as { lat: number }).lat) < 1e-5 &&
          Math.abs(p.lon - (picked.spot as { lon: number }).lon) < 1e-5,
      )?.id ?? null)
    : null;

  // Whether the fix is inside somewhere already named, which decides between
  // telling you where you are and offering to name it.
  const at = you ? placeAt(you, places) : null;

  const search = async (text: string, where: Scope) => {
    const q = text.trim();
    if (!q) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setSearching(true);
    trouble.clear();
    try {
      const results = await findPlaces(q, where, abort.current.signal);
      setHits(results);
      if (results.length === 0) {
        // The search worked; the name is what missed. Running it again returns
        // the same nothing.
        trouble.wrong(
          where === 'campus'
            ? 'Nothing on campus by that name. Try Nashville — some of Vanderbilt sits outside the box.'
            : 'Nothing found around Nashville by that name.',
        );
        return;
      }
      // Land on the first result rather than leaving the person to tap it: the
      // search was the tap, and a list that requires another one to show you
      // anything has asked twice for one answer.
      const first = foundStop(results[0]);
      setPickedKey(first.key);
      setNaming(q);
      setCentre({ lat: first.spot?.lat ?? centre.lat, lon: first.spot?.lon ?? centre.lon, zoom: 17 });
      setZoom(where === 'campus' ? 17 : 15);
    } catch (e) {
      trouble.failed(e, () => void search(q, where));
    } finally {
      setSearching(false);
    }
  };

  /** A room with no coordinate, looked up by its building name. */
  const findBuilding = (stop: Stop) => {
    setScope('campus');
    setQuery(stop.building);
    void search(stop.building, 'campus');
  };

  const locate = async () => {
    trouble.clear();
    try {
      const fix = await here();
      setYou(fix);
      setCentre({ lat: fix.lat, lon: fix.lon, zoom: 17 });
      setZoom(17);
    } catch (e) {
      // A refused permission stays refused until the student changes it in
      // the browser, but a timeout or a lost fix is worth another go, and
      // nothing here can tell which from the outside.
      trouble.failed(explainPlaceError(e), () => void locate());
    }
  };

  const keep = (stop: Stop, label: string) => {
    if (!stop.spot || !label.trim()) return;
    dispatch({
      type: 'addPlace',
      place: { label: label.trim(), lat: stop.spot.lat, lon: stop.spot.lon, radius: DEFAULT_RADIUS },
    });
    setNaming('');
  };

  const goHref = (stop: Stop) =>
    apple ? appleMapsUrl(stop.dest, mode) : directionsUrl(stop.dest, mode);

  /**
   * The next class, as a stop, so the banner speaks the same language.
   *
   * The banner is drawn for whatever class is genuinely next, room or no
   * room. A class whose syllabus named none — ECON, in the semester this app
   * ships with — gets the banner saying so, rather than the screen quietly
   * skipping forward to a class that has one and calling that "next".
   */
  const upNext = nextClass(catalog, now);
  const nextStop = upNext
    ? stopFor(
        `next-${upNext.block.at}`,
        'class',
        upNext.block.c ? codeOf(catalog, upNext.block.c) : upNext.block.title,
        roomOf(upNext.block),
        { at: upNext.block.at, time: upNext.block.time },
      )[0]
    : undefined;
  const nextReach = spot && nextStop?.spot ? reach(spot, nextStop.spot) : null;
  // Only today's, and only from where you actually are: "leave in 9 minutes"
  // for a class tomorrow morning would be nonsense, and so would one measured
  // from a building you are not in.
  const setOff =
    nextReach && nextStop?.at !== undefined && !upNext?.isTomorrow && upNext !== null && upNext.inMinutes < 600
      ? leaving(minutes, nextStop.at, nextReach.minutes)
      : null;

  const suggestions = matchStops(everything, query);

  const measured = (stop: Stop): string => {
    const r = spot && stop.spot ? reach(spot, stop.spot) : null;
    return r ? r.line : '';
  };

  const row = (stop: Stop, note?: string) => (
    <div
      key={stop.key}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-5)',
        background: pickedKey === stop.key ? 'var(--app-accent-wash)' : 'transparent',
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={() => pick(stop)}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', ...linkRow }}
      >
        <span style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
          {stop.time && (
            <span style={{ fontSize: 'var(--type-sm)', opacity: 0.55, flex: 'none' }}>{stop.time}</span>
          )}
          <span style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)', flex: 1, minWidth: 0 }}>
            {stop.label}
          </span>
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--type-xs)',
            opacity: 0.55,
            marginTop: 'var(--sp-1)',
          }}
        >
          {[stop.detail, note ?? measured(stop)].filter(Boolean).join(' · ')}
        </span>
      </button>
      {/* 29×17, in a row with the stop itself and a chevron either side of it,
          so `tap-y`: the row is 46px tall and there is room above and below,
          and none at all beside. */}
      <a
        href={goHref(stop)}
        target="_blank"
        rel="noreferrer"
        className="tap-y"
        aria-label={`Directions to ${stop.label}`}
        style={{
          flex: 'none',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.08em',
          opacity: 0.7,
          textDecoration: 'none',
        }}
      >
        GO →
      </a>
      <ChevronRight size={16} style={{ opacity: 0.3, flex: 'none' }} />
    </div>
  );

  return (
    <Page>
    <>
      {/*
        The one thing this screen knows that a phone's map app never will:
        which room you are due in, and when. It sits above everything because
        on most openings it is the whole question.
      */}
      {upNext && (
        <Blueprint style={{ padding: 'var(--sp-6)', background: 'var(--app-hero)' }}>
          <div className="kicker">{upNext.isTomorrow ? 'Tomorrow' : 'Next class'}</div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xl)',
              marginTop: 'var(--sp-2)',
              lineHeight: 'var(--leading-tight)',
            }}
          >
            {upNext.block.c ? codeOf(catalog, upNext.block.c) : upNext.block.title} ·{' '}
            {upNext.block.time}
          </div>
          <div style={{ fontSize: 'var(--type-md)', opacity: 0.7, marginTop: 'var(--sp-2)' }}>
            {[nextStop?.detail ?? 'No room on the syllabus', nextReach?.line]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div
            style={{
              fontSize: 'var(--type-md)',
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-normal)',
              color:
                setOff?.urgency === 'late' || setOff?.urgency === 'now'
                  ? 'var(--app-warn)'
                  : 'inherit',
              opacity: setOff ? 1 : 0.55,
            }}
          >
            {setOff
              ? setOff.line
              : !nextStop
                ? `The syllabus names no room for this one, so there is nowhere to send you. Add it in Edit the course and this fills in.`
                : nextStop.spot
                  ? 'Tap “Where am I” and this says when to leave.'
                  : `Nothing saved for ${nextStop.building} yet, so there is no walk to measure.`}
          </div>
          {nextStop && (
            <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
              <ActionButton
                tone="primary"
                onClick={() => pick(nextStop)}
                style={{ fontSize: 'var(--type-xs)' }}
              >
                {nextStop.spot ? 'Show it' : 'Find it'}
              </ActionButton>
              <a
                href={goHref(nextStop)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-block"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  fontSize: 'var(--type-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Directions
              </a>
            </div>
          )}
        </Blueprint>
      )}

      <SectionLabel>Find a place</SectionLabel>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query, scope);
        }}
        style={{ display: 'flex', gap: 'var(--sp-4)' }}
      >
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={scope === 'campus' ? 'Rand, Buttrick, your 9:05…' : 'An address, a place…'}
          aria-label="Search for a place"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={searching || !query.trim()}
          style={{ flex: 'none', padding: '0 var(--sp-7)', height: 44 }}
        >
          {searching ? '…' : 'Find'}
        </button>
      </form>

      {/*
        Your own places, classes and rooms, matched as you type. No request
        goes out for these: they are in memory, they answer instantly, and
        they are what was meant nine times in ten. The search button is for
        the tenth.
      */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          {suggestions.map((stop) => (
            <button
              key={`hint-${stop.key}`}
              type="button"
              className="bare tappable"
              onClick={() => {
                pick(stop);
                setQuery('');
              }}
              style={{ textAlign: 'left', ...linkRow }}
            >
              <span style={{ fontSize: 'var(--type-md)' }}>{stop.label}</span>
              <span style={{ fontSize: 'var(--type-xs)', opacity: 0.5 }}> · {stop.detail}</span>
            </button>
          ))}
        </div>
      )}

      <Segmented
        options={[
          { id: 'campus', label: 'Campus' },
          { id: 'city', label: 'Nashville' },
        ]}
        value={scope}
        onChange={(next) => {
          // Asking for the city rather than the campus means moving the map.
          setScope(next);
          setCentre(CENTRES[next]);
          setZoom(CENTRES[next].zoom);
          setHits([]);
          trouble.clear();
        }}
        style={{ margin: 'var(--sp-5) 0' }}
      />

      <Suspense
        fallback={
          <div
            style={{
              height: tall ? TALL : SHORT,
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--app-line)',
              background: 'var(--app-panel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--type-sm)',
              opacity: 0.5,
            }}
          >
            Loading the map…
          </div>
        }
      >
        <LiveMap
          pins={pins}
          centre={centre}
          zoom={zoom}
          height={tall ? TALL : SHORT}
          selected={shown}
          fit={fit}
        />
      </Suspense>

      {/*
        `--sp-7` rather than `--sp-4`, and the four pixels are load-bearing.

        Leaflet draws its attribution — a link, and one this app is obliged to
        keep — at the foot of the map, three pixels above its bottom edge. The
        three controls below grew to a 44px target, which is centred on a 17px
        label and so reaches 13.5px above it; at an 8px gap that put "Bigger"
        over the last two pixels of "Leaflet", and the later element in the
        document wins a tap. `--sp-7` clears it at every density.
      */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-5)',
          alignItems: 'center',
          marginTop: 'var(--sp-7)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.08em',
          opacity: 0.75,
        }}
      >
        {/*
          `tap-y`, because these are 17px tall.

          Three caps labels under the map, set at `--type-xs`: measured on the
          running app at 390×844 they are 68×17, 43×17 and 42×17, against a
          fingertip's 44. They are the row that makes the map usable — where
          you are, everything at once, and bigger — and each was a miss. The
          axis is `y` rather than both for the reason the audit gives in
          app.css: they share a row, and a target that grew sideways would
          reach into the neighbour beside it.
        */}
        {locationSupported() && (
          <button
            type="button"
            className="bare tap-y"
            onClick={() => void locate()}
            style={{ width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.08em' }}
          >
            WHERE AM I
          </button>
        )}
        <button
          type="button"
          className="bare tap-y"
          onClick={() => setFit((n) => n + 1)}
          disabled={pins.length === 0}
          style={{ width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.08em' }}
        >
          FIT ALL
        </button>
        <button
          type="button"
          className="bare tap-y"
          onClick={() => setTall((t) => !t)}
          style={{ width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.08em' }}
        >
          {tall ? 'SMALLER' : 'BIGGER'}
        </button>
      </div>
      <Trouble said={trouble.said} onRetry={trouble.again} busy={searching} />

      {/*
        The one tap that makes the rest of this screen work on a fresh install.
        Everything above it — the walk, the leave-by, the pins — needs a
        coordinate per building, and until this existed the only ways to get
        one were to stand in the doorway or to search eight times by hand.
      */}
      <FillPlaces buildings={unplaced(everything)} />

      {/*
        One panel for whatever is selected, whether it was tapped on the map or
        in a list. Everything you can do with a place is in it — how far, how
        you are travelling, which map app, and whether to keep it — rather than
        scattered down the screen away from the thing it acts on.
      */}
      {picked && (
        <Blueprint style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-6)' }}>
          <div className="kicker">
            {picked.kind === 'class'
              ? 'Class today'
              : picked.kind === 'saved'
                ? 'Your place'
                : picked.kind === 'room'
                  ? 'This semester'
                  : 'Found'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xl)',
              marginTop: 'var(--sp-2)',
              lineHeight: 'var(--leading-tight)',
            }}
          >
            {picked.label}
          </div>
          <div style={{ fontSize: 'var(--type-md)', opacity: 0.7, marginTop: 'var(--sp-2)' }}>
            {picked.detail}
          </div>
          <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-3)', opacity: 0.9 }}>
            {pickedReach
              ? pickedReach.line
              : picked.spot
                ? 'Tap “Where am I” for the distance.'
                : `No coordinates for ${picked.building} yet.`}
          </div>

          <ChipRow
            options={TRAVEL.map((t) => t.label)}
            value={TRAVEL.find((t) => t.id === mode)?.label ?? 'Walk'}
            onChange={(label) => {
              const chosen = TRAVEL.find((t) => t.label === label);
              if (chosen) setMode(chosen.id);
            }}
            style={{ marginTop: 'var(--sp-5)' }}
          />

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            <a
              href={directionsUrl(picked.dest, mode)}
              target="_blank"
              rel="noreferrer"
              className={`btn btn-${apple ? 'secondary' : 'primary'} btn-block`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Google Maps
            </a>
            <a
              href={appleMapsUrl(picked.dest, mode)}
              target="_blank"
              rel="noreferrer"
              className={`btn btn-${apple ? 'primary' : 'secondary'} btn-block`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Apple Maps
            </a>
          </div>

          {/*
            The step that makes the rest of the app work. A room the app has
            found is a coordinate it can measure from, draw a pin for and walk
            you between — but only once you have said "yes, that is the one",
            because a search result kept without asking is a guess with a name
            on it.
          */}
          {picked.spot && !held && (
            <>
              <input
                className="input"
                value={naming}
                onChange={(e) => setNaming(e.target.value)}
                placeholder="Buttrick, Central Library, home…"
                aria-label="Name this place"
                style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-6)' }}
              />
              <ActionButton
                disabled={!naming.trim()}
                onClick={() => keep(picked, naming)}
                tone="primary"
                style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--type-xs)' }}
              >
                Keep this place
              </ActionButton>
              <div
                style={{
                  fontSize: 'var(--type-xs)',
                  opacity: 0.5,
                  marginTop: 'var(--sp-3)',
                  lineHeight: 'var(--leading-normal)',
                }}
              >
                Named after the building, it matches every room in it — the walk between two
                classes on Today starts working too.
              </div>
            </>
          )}

          {!picked.spot && (
            <ActionButton
              onClick={() => findBuilding(picked)}
              tone="primary"
              disabled={searching}
              style={{ marginTop: 'var(--sp-6)', fontSize: 'var(--type-xs)' }}
            >
              {searching ? 'Looking…' : `Find ${picked.building} on the map`}
            </ActionButton>
          )}

          {/*
            Only from the place itself. A class row is *positioned by* a saved
            place, and putting the button that deletes Garland under the words
            "PSCI 1104" is how somebody deletes Garland while meaning to drop a
            class.
          */}
          {held && picked.kind !== 'saved' && (
            <div
              style={{
                fontSize: 'var(--type-xs)',
                opacity: 0.5,
                marginTop: 'var(--sp-5)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              Positioned from your saved place “{held.label}”.
            </div>
          )}

          {held && picked.kind === 'saved' && (
            <button
              type="button"
              className="bare"
              onClick={() => {
                dispatch({ type: 'removePlace', id: held.id });
                setPickedKey(null);
              }}
              style={{
                width: 'auto',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.1em',
                opacity: 0.5,
                marginTop: 'var(--sp-6)',
              }}
            >
              FORGET THIS PLACE
            </button>
          )}
        </Blueprint>
      )}

      {/*
        Standing somewhere and naming it is the app's own route to a place, and
        it belongs next to the map rather than in a tab of its own. Nothing is
        looked up: the coordinates come from the device, the name comes from
        you, and the pair never leaves this browser.
      */}
      {you && !at && (
        <Blueprint style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-6)', background: 'var(--app-hero)' }}>
          <div className="kicker">Somewhere new</div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-lg)',
              marginTop: 'var(--sp-2)',
            }}
          >
            Not a place you have named
          </div>
          <div style={{ fontSize: 'var(--type-xs)', opacity: 0.55, marginTop: 'var(--sp-2)' }}>
            Accurate to about {far(you.accuracy)}.
          </div>
          <input
            className="input"
            value={standing}
            onChange={(e) => setStanding(e.target.value)}
            placeholder="Alumni Hall, Central Library, home…"
            aria-label="Name where you are standing"
            style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-6)' }}
          />
          <ActionButton
            disabled={!standing.trim()}
            onClick={() => {
              dispatch({
                type: 'addPlace',
                place: {
                  label: standing.trim(),
                  lat: you.lat,
                  lon: you.lon,
                  radius: DEFAULT_RADIUS,
                },
              });
              setStanding('');
            }}
            tone="primary"
            style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--type-xs)' }}
          >
            Save this spot
          </ActionButton>
        </Blueprint>
      )}

      {you && at && (
        <div
          style={{
            fontSize: 'var(--type-md)',
            marginTop: 'var(--sp-6)',
            opacity: 0.75,
            lineHeight: 'var(--leading-normal)',
          }}
        >
          You are at <strong>{at.label}</strong>, give or take {far(you.accuracy)}.
        </div>
      )}

      {found.length > 0 && (
        <>
          <SectionLabel aside={<Clear onClick={() => setHits([])} />}>Found</SectionLabel>
          {found.map((stop) => row(stop))}
        </>
      )}

      {today.length > 0 && (
        <>
          <SectionLabel>Where you are due today</SectionLabel>
          {today.map((stop) =>
            row(
              stop,
              stop.spot
                ? undefined
                : `no place saved for ${stop.building}`,
            ),
          )}
        </>
      )}

      {saved.length > 0 && (
        <>
          <SectionLabel>Your places</SectionLabel>
          {/* Nearest first once the app knows where you are — how far a place
              is beats the order you happened to save it in. */}
          {nearestFirst(saved, spot).map((m) => row(m.stop))}
        </>
      )}

      {rooms.length > 0 && (
        <>
          <SectionLabel>Every room this semester</SectionLabel>
          {rooms.map((stop) =>
            row(stop, stop.spot ? undefined : `tap to find ${stop.building}`),
          )}
        </>
      )}

      <SectionLabel>The official maps</SectionLabel>
      <a href={CAMPUS_MAP} target="_blank" rel="noreferrer" className="bare">
        <Blueprint
          plain
          style={{ padding: 'var(--sp-6)', display: 'flex', gap: 'var(--sp-6)', alignItems: 'center' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kicker" style={{ display: 'block' }}>
              Campus
            </span>
            <span style={{ display: 'block', fontSize: 'var(--type-md)', marginTop: 'var(--sp-1)' }}>
              Vanderbilt's own map — buildings, entrances, parking
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </Blueprint>
      </a>
      <a href={CITY_MAP} target="_blank" rel="noreferrer" className="bare">
        <Blueprint
          plain
          style={{
            padding: 'var(--sp-6)',
            marginTop: 'var(--sp-5)',
            display: 'flex',
            gap: 'var(--sp-6)',
            alignItems: 'center',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kicker" style={{ display: 'block' }}>
              Nashville
            </span>
            <span style={{ display: 'block', fontSize: 'var(--type-md)', marginTop: 'var(--sp-1)' }}>
              The city and what surrounds it, in Google Maps
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </Blueprint>
      </a>

      {saved.length === 0 && (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.55,
            marginTop: 'var(--sp-7)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          Nothing saved yet. Tap a room above and press “Find it”, or stand somewhere that matters
          and press “Where am I”. Either way the app ends up with a real coordinate, which routes
          better than any search for a building name — and every walk on this screen and on Today
          starts working the moment it has one.
        </div>
      )}

      {/* The other route to a place, for the addresses you cannot stand in
          front of. Off until switched on — see `lib/geocode.ts`. */}
      <div style={{ marginTop: 'var(--sp-7)' }}>
        <FindPlace />
      </div>
    </>
    </Page>
  );
}

/** The one control the Found list needs: put it away. */
function Clear({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="bare"
      onClick={onClick}
      style={{ width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.1em', opacity: 0.5 }}
    >
      CLEAR
    </button>
  );
}
