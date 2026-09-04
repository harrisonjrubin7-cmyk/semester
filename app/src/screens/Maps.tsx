import { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { Blueprint } from '../components/Blueprint';
import type { Pin } from '../components/LiveMap';
import { ChipRow, SectionLabel, Segmented } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import {
  CENTRES,
  OSM_CREDIT,
  findPlaces,
  type Found,
  type Scope,
} from '../lib/findplace';
import { explainPlaceError, far, here, locationSupported, metresBetween } from '../lib/place';
import {
  CAMPUS_MAP,
  CITY_MAP,
  TRAVEL,
  appleMapsUrl,
  directionsUrl,
  fromRoom,
  prefersApple,
  type Destination,
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

interface Row {
  key: string;
  label: string;
  where: string;
  dest: Destination;
}

/**
 * Getting there.
 *
 * Two halves. The map is a real one — pannable, searchable, drawn from
 * OpenStreetMap — and it exists because OSM asks for attribution where Google
 * asks for an API key, which would mean a billing account and a credential in
 * the page of an app anyone can view-source.
 *
 * The list under it is the half a study app is uniquely able to fill in: your
 * classes today, your saved places, every room from every syllabus. Nobody
 * else knows those. Tapping one hands the destination to the map app your
 * phone already has, which has your live position, talks to you, and works
 * with the screen off — so the app stops exactly where it stops being the best
 * tool for the job.
 */
export function Maps() {
  const { state, now, catalog } = useStore();
  const [mode, setMode] = useState<Travel>('walking');
  const [scope, setScope] = useState<Scope>('campus');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);
  const trouble = useTrouble();
  const [you, setYou] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [centre, setCentre] = useState(CENTRES.campus);
  const [zoom, setZoom] = useState(CENTRES.campus.zoom);
  const abort = useRef<AbortController | null>(null);
  const apple = prefersApple();

  const today = now.getDay();
  const classes: Row[] = catalog.modules.flatMap((m) =>
    (m.schedule ?? [])
      .filter((s) => s.days.includes(today))
      .map((s) => ({
        key: `${m.course.id}-${s.at}`,
        label: `${m.course.code} · ${s.time}`,
        where: m.course.room || s.meta,
        dest: fromRoom(m.course.room || s.meta),
      })),
  );

  const rooms: Row[] = catalog.courses
    .filter((c) => c.room)
    .map((c) => ({ key: c.id, label: c.code, where: c.room, dest: fromRoom(c.room) }));

  const saved: Row[] = state.places.map((p) => ({
    key: p.id,
    label: p.label,
    where: 'Saved by you',
    // A place you stood in has real coordinates, which beat any search.
    dest: { query: p.label, lat: p.lat, lon: p.lon },
  }));

  // Only things with real coordinates can be drawn. A room name is a search
  // string, not a position, and plotting a guess would be worse than nothing.
  const pins: Pin[] = useMemo(() => {
    const list: Pin[] = state.places.map((p) => ({
      id: `place-${p.id}`,
      lat: p.lat,
      lon: p.lon,
      label: p.label,
      tone: 'saved' as const,
    }));
    for (const h of hits) {
      list.push({
        id: `hit-${h.id}`,
        lat: h.lat,
        lon: h.lon,
        label: h.name,
        tone: 'result' as const,
        onOpen: () => setPicked(h),
      });
    }
    if (you) {
      list.push({ id: 'you', lat: you.lat, lon: you.lon, label: 'You are here', tone: 'you' });
    }
    return list;
  }, [state.places, hits, you]);

  const search = async () => {
    const text = query.trim();
    if (!text) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setSearching(true);
    trouble.clear();
    setPicked(null);
    try {
      const found = await findPlaces(text, scope, abort.current.signal);
      setHits(found);
      if (found.length === 0) {
        // The search worked; the name is what missed. Running it again returns
        // the same nothing.
        trouble.wrong(
          scope === 'campus'
            ? 'Nothing on campus by that name. Try the city — some of Vanderbilt sits outside the box.'
            : 'Nothing found around Nashville by that name.',
        );
      } else {
        setCentre({ lat: found[0].lat, lon: found[0].lon, zoom: 17 });
        setZoom(scope === 'campus' ? 17 : 15);
      }
    } catch (e) {
      trouble.failed(e, () => void search());
    } finally {
      setSearching(false);
    }
  };

  const locate = async () => {
    trouble.clear();
    try {
      const fix = await here();
      setYou({ lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy });
      setCentre({ lat: fix.lat, lon: fix.lon, zoom: 17 });
      setZoom(17);
    } catch (e) {
      // A refused permission stays refused until the student changes it in
      // the browser, but a timeout or a lost fix is worth another go, and
      // nothing here can tell which from the outside.
      trouble.failed(explainPlaceError(e), () => void locate());
    }
  };

  const row = (item: Row) => (
    <a
      key={item.key}
      href={apple ? appleMapsUrl(item.dest, mode) : directionsUrl(item.dest, mode)}
      target="_blank"
      rel="noreferrer"
      className="bare tappable"
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '13px 0',
        borderBottom: '1px solid var(--app-line)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.25 }}>{item.label}</span>
        <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
          {item.where}
        </span>
      </span>
      <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
    </a>
  );

  return (
    <div style={{ padding: 18 }}>
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
        style={{ marginBottom: 12 }}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 10 }}
      >
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={scope === 'campus' ? 'Rand, Buttrick, the rec…' : 'An address, a place…'}
          aria-label="Search for a place"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={searching || !query.trim()}
          style={{ flex: 'none', padding: '0 16px', height: 44 }}
        >
          {searching ? '…' : 'Find'}
        </button>
      </form>

      <Suspense
        fallback={
          <div
            style={{
              height: 310,
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--app-line)',
              background: 'var(--app-panel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'calc(12.5px * var(--text-scale, 1))',
              opacity: 0.5,
            }}
          >
            Loading the map…
          </div>
        }
      >
        <LiveMap pins={pins} centre={centre} zoom={zoom} height={310} />
      </Suspense>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginTop: 8,
          fontSize: 'calc(11px * var(--text-scale, 1))',
          opacity: 0.5,
        }}
      >
        <span style={{ flex: 1 }}>{OSM_CREDIT}</span>
        {locationSupported() && (
          <button
            type="button"
            className="bare"
            onClick={() => void locate()}
            style={{ width: 'auto', fontSize: 'calc(11px * var(--text-scale, 1))', letterSpacing: '0.08em', opacity: 0.9 }}
          >
            WHERE AM I
          </button>
        )}
      </div>

      <Trouble said={trouble.said} onRetry={trouble.again} busy={Boolean(searching)} />

      {hits.length > 0 && (
        <>
          <SectionLabel>Found</SectionLabel>
          {hits.map((h) => {
            const dest: Destination = { query: h.name, lat: h.lat, lon: h.lon };
            const away = you ? metresBetween(you, h) : null;
            return (
              <div
                key={h.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  borderBottom: '1px solid var(--app-line)',
                  background: picked?.id === h.id ? 'var(--app-accent-wash)' : 'transparent',
                }}
              >
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() => {
                    setPicked(h);
                    setCentre({ lat: h.lat, lon: h.lon, zoom: 17 });
                    setZoom(17);
                  }}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '12px 0' }}
                >
                  <span style={{ display: 'block', fontSize: 'calc(14.5px * var(--text-scale, 1))', lineHeight: 1.25 }}>
                    {h.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                    {[h.kind, h.detail, away === null ? '' : far(away)].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <a
                  href={apple ? appleMapsUrl(dest, mode) : directionsUrl(dest, mode)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 'none',
                    fontSize: 'calc(11px * var(--text-scale, 1))',
                    letterSpacing: '0.08em',
                    opacity: 0.75,
                    textDecoration: 'none',
                  }}
                >
                  GO →
                </a>
              </div>
            );
          })}
        </>
      )}

      <SectionLabel>How you are getting there</SectionLabel>
      <ChipRow
        options={TRAVEL.map((t) => t.label)}
        value={TRAVEL.find((t) => t.id === mode)?.label ?? 'Walk'}
        onChange={(label) => {
          const found = TRAVEL.find((t) => t.label === label);
          if (found) setMode(found.id);
        }}
      />
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
        Directions open in the map app this phone already has — it knows where you are, it talks,
        and it works with the screen off.
      </div>

      {classes.length > 0 && (
        <>
          <SectionLabel>Where you are due today</SectionLabel>
          {classes.map(row)}
        </>
      )}

      {saved.length > 0 && (
        <>
          <SectionLabel>Your places</SectionLabel>
          {saved.map(row)}
        </>
      )}

      {rooms.length > 0 && (
        <>
          <SectionLabel>Every room this semester</SectionLabel>
          {rooms.map(row)}
        </>
      )}

      <SectionLabel>The official maps</SectionLabel>
      <a href={CAMPUS_MAP} target="_blank" rel="noreferrer" className="bare">
        <Blueprint
          style={{ padding: '14px 15px', display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kicker" style={{ display: 'block' }}>
              Campus
            </span>
            <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 2 }}>
              Vanderbilt's own map — buildings, entrances, parking
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </Blueprint>
      </a>
      <a href={CITY_MAP} target="_blank" rel="noreferrer" className="bare">
        <Blueprint
          style={{
            padding: '14px 15px',
            marginTop: 10,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kicker" style={{ display: 'block' }}>
              Nashville
            </span>
            <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 2 }}>
              The city and what surrounds it, in Google Maps
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </Blueprint>
      </a>

      {saved.length === 0 && (
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 16, lineHeight: 1.5 }}>
          Name a few places under Mine → Places and they appear on the map with exact coordinates,
          which route better than any search for a building name.
        </div>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
