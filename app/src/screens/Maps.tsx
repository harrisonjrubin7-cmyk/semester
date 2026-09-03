import { useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, SectionLabel } from '../components/ui';
import { ChevronRight } from '../components/Icons';
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
 * Getting there.
 *
 * The useful half of a map feature in a study app is not the map — it is
 * knowing the destination. This app already holds every room from every
 * syllabus and every place you have named, so the list below is the one you
 * actually need, already filled in: your classes today, then everything else
 * you go to.
 *
 * The map itself is handed to the app your phone already has. That is not a
 * shortcut around embedding one: a live map needs a Google API key sitting in
 * the page for anyone to lift, and it would still know less than the maps app
 * does — which has your position, talks to you, and works with the screen off.
 */
export function Maps() {
  const { state, now, catalog } = useStore();
  const [mode, setMode] = useState<Travel>('walking');
  const apple = prefersApple();

  const today = now.getDay();
  const classes = catalog.modules.flatMap((m) =>
    (m.schedule ?? [])
      .filter((s) => s.days.includes(today))
      .map((s) => ({
        key: `${m.course.id}-${s.at}`,
        label: `${m.course.code} · ${s.time}`,
        where: m.course.room || s.meta,
        dest: fromRoom(m.course.room || s.meta),
      })),
  );

  const rooms = catalog.courses
    .filter((c) => c.room)
    .map((c) => ({ key: c.id, label: c.code, where: c.room, dest: fromRoom(c.room) }));

  const saved = state.places.map((p) => ({
    key: p.id,
    label: p.label,
    where: 'Saved by you',
    // A place you stood in has real coordinates, which beat any search.
    dest: { query: p.label, lat: p.lat, lon: p.lon } as Destination,
  }));

  const row = (item: { key: string; label: string; where: string; dest: Destination }) => (
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
        <span style={{ display: 'block', fontSize: 15, lineHeight: 1.25 }}>{item.label}</span>
        <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
          {item.where}
        </span>
      </span>
      <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
    </a>
  );

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5, textWrap: 'pretty' }}>
        Directions open in the map app this phone already has — it knows where you are, it talks,
        and it works with the screen off. The app's part is knowing where you are going, and it
        does: every room from your syllabi, and every place you have named.
      </div>

      <SectionLabel>How you are getting there</SectionLabel>
      <ChipRow
        options={TRAVEL.map((t) => t.label)}
        value={TRAVEL.find((t) => t.id === mode)?.label ?? 'Walk'}
        onChange={(label) => {
          const found = TRAVEL.find((t) => t.label === label);
          if (found) setMode(found.id);
        }}
      />

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

      <SectionLabel>The maps themselves</SectionLabel>
      <a href={CAMPUS_MAP} target="_blank" rel="noreferrer" className="bare">
        <Blueprint
          style={{ padding: '14px 15px', display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kicker" style={{ display: 'block' }}>
              Campus
            </span>
            <span style={{ display: 'block', fontSize: 14, marginTop: 2 }}>
              Vanderbilt's own map — buildings, entrances, parking
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </Blueprint>
      </a>
      <a href={CITY_MAP} target="_blank" rel="noreferrer" className="bare">
        <Blueprint
          style={{ padding: '14px 15px', marginTop: 10, display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kicker" style={{ display: 'block' }}>
              Nashville
            </span>
            <span style={{ display: 'block', fontSize: 14, marginTop: 2 }}>
              The city and what surrounds it
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </Blueprint>
      </a>

      {saved.length === 0 && (
        <div style={{ fontSize: 12, opacity: 0.55, marginTop: 16, lineHeight: 1.5 }}>
          Name a few places under Mine → Places and they appear here with exact coordinates, which
          route better than any search for a building name.
        </div>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
