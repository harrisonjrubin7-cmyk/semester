import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from './Blueprint';
import { Trouble } from './Trouble';
import { useTrouble } from '../lib/trouble';
import { ActionButton, TickBox } from './ui';
import { useRowStyle } from './shell/useShell';
import { findPlaces } from '../lib/findplace';
import { DEFAULT_RADIUS } from '../lib/place';
import { fillLine, foundLine, judge, progressLine, type Candidate } from '../lib/locate';

/**
 * Every building this semester names, put on the map in one tap.
 *
 * The rest of the map screen can measure a walk, say when to leave and draw a
 * pin — for a building it has a coordinate for. A new install has none, so
 * everything on the screen that is worth having was behind eight small acts of
 * setup: stand in the doorway of each building, or search for each by hand.
 *
 * This is those eight acts as one. It reads the buildings the app cannot place,
 * looks each up in OpenStreetMap, and shows what came back with a tick beside
 * it before anything is saved. See `lib/locate.ts` for why the coordinates are
 * looked up rather than compiled into the app, and why a result from outside
 * the campus box arrives unticked.
 */
export function FillPlaces({ buildings }: { buildings: string[] }) {
  const { dispatch } = useStore();
  const row = useRowStyle(11);
  const trouble = useTrouble();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [list, setList] = useState<Candidate[] | null>(null);
  const abort = useRef<AbortController | null>(null);

  if (buildings.length === 0 && !list) return null;

  const run = async () => {
    abort.current?.abort();
    abort.current = new AbortController();
    const signal = abort.current.signal;
    setBusy(true);
    setDone(0);
    setList([]);
    trouble.clear();
    const out: Candidate[] = [];
    try {
      for (const building of buildings) {
        if (signal.aborted) return;
        // One at a time, in order. `findPlaces` holds itself to a request a
        // second, which is what OpenStreetMap's usage policy asks for; issuing
        // these in parallel would be the one thing that policy forbids.
        const hits = await findPlaces(building, 'campus', signal);
        out.push(judge(building, hits));
        setList([...out]);
        setDone(out.length);
      }
    } catch (e) {
      // Whatever was found before the failure is kept on screen and still
      // saveable — throwing away four good answers because the fifth timed
      // out would make a retry cost the four again.
      trouble.failed(e, () => void run());
    } finally {
      setBusy(false);
    }
  };

  const keep = () => {
    for (const c of list ?? []) {
      if (!c.keep || !c.hit) continue;
      dispatch({
        type: 'addPlace',
        // Saved under the name the syllabus uses, not the one OpenStreetMap
        // uses: "Garland" is what the room says, and matching a room to a place
        // is done on that word.
        place: { label: c.building, lat: c.hit.lat, lon: c.hit.lon, radius: DEFAULT_RADIUS },
      });
    }
    setList(null);
  };

  const ticked = (list ?? []).filter((c) => c.keep && c.hit).length;

  return (
    <Blueprint style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-6)', background: 'var(--app-hero)' }}>
      <div className="kicker">Your buildings</div>
      <div
        style={{
          fontSize: 'var(--type-md)',
          marginTop: 'var(--sp-3)',
          lineHeight: 'var(--leading-normal)',
        }}
      >
        {busy ? progressLine(done, buildings.length) : list ? foundLine(list) : fillLine(buildings.length)}
      </div>

      {!list && !busy && (
        <>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              opacity: 0.55,
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            {buildings.join(' · ')}
          </div>
          <ActionButton
            tone="primary"
            onClick={() => void run()}
            style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--type-xs)' }}
          >
            Find them on the map
          </ActionButton>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              opacity: 0.5,
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            Each name goes to OpenStreetMap, one a second, and nothing is saved until you have
            seen what came back.
          </div>
        </>
      )}

      {list?.map((c, i) => (
        <button
          key={c.building}
          type="button"
          className="bare tappable"
          disabled={!c.hit}
          aria-pressed={c.keep}
          onClick={() =>
            setList((was) =>
              (was ?? []).map((x, j) => (i === j ? { ...x, keep: !x.keep } : x)),
            )
          }
          style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'center', textAlign: 'left', ...row }}
        >
          <TickBox on={c.keep} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{c.building}</span>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--type-xs)',
                opacity: 0.55,
                marginTop: 'var(--sp-1)',
              }}
            >
              {c.line}
            </span>
          </span>
        </button>
      ))}

      <Trouble said={trouble.said} onRetry={trouble.again} busy={busy} />

      {list && !busy && (
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
          <ActionButton tone="primary" disabled={ticked === 0} onClick={keep} style={{ fontSize: 'var(--type-xs)' }}>
            {ticked === 0 ? 'Nothing ticked' : `Keep ${ticked}`}
          </ActionButton>
          <ActionButton onClick={() => setList(null)} style={{ fontSize: 'var(--type-xs)' }}>
            Not now
          </ActionButton>
        </div>
      )}
    </Blueprint>
  );
}
