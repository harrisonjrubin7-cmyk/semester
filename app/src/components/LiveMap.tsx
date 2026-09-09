import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OSM_CREDIT, TILES } from '../lib/findplace';
import { offline, watchConnection } from '../lib/offline';

export interface Pin {
  id: string;
  lat: number;
  lon: number;
  label: string;
  /** Decides the marker's look: where you are, where you have to be, or a hit. */
  tone: 'you' | 'class' | 'saved' | 'result';
  onOpen?: () => void;
  /**
   * Metres of uncertainty, drawn as a ring around the pin.
   *
   * Only the "you" pin has one, and it matters: a phone indoors is often sure
   * of itself to fifty metres, and a dot with no ring reads as certainty the
   * device never claimed.
   */
  spread?: number;
  /** A character drawn inside the marker — "1", "2" for today's order. */
  badge?: string;
}

/**
 * A real map, panned and zoomed with a finger.
 *
 * Built on OpenStreetMap rather than Google, and that is the whole reason it
 * can exist here: Google's map wants an API key, which means a billing account
 * and a credential sitting in the page of an app anyone can view-source. OSM's
 * tiles want attribution, which is a line of text.
 *
 * Leaflet is imperative and React is not, so the map is created once against a
 * ref and never re-created. Only the markers are torn down and redrawn when
 * the pins change — re-creating the map on every render would throw away the
 * pan and zoom the person just did, which is the single most annoying bug an
 * embedded map can have.
 *
 * The markers are drawn as CSS rather than as the default Leaflet PNG. Not for
 * looks: the default icon is loaded from a relative URL that breaks under a
 * subpath deployment like GitHub Pages, and a map of invisible markers is a
 * hard bug to see coming.
 *
 * ## Selecting, and fitting
 *
 * Two things a map like this is asked for constantly and did not do. Tapping a
 * pin now tells the screen which one — so the row, the distance and the
 * directions button all follow the map instead of the map being a picture
 * beside them — and the selected pin is drawn larger with a ring, because a
 * screen that says "Rand" while every dot looks identical has not answered
 * "which one is Rand".
 *
 * `fit` fits the view to everything at once. It is a counter rather than a
 * flag: the screen bumps it when the person presses "Fit all", and a number
 * that changed is a request that happened, where a boolean that is still true
 * is indistinguishable from one nobody pressed.
 *
 * ## When the tiles cannot come
 *
 * The tiles are the one thing on this screen that needs a connection, and they
 * are the one thing this app cannot keep on the device — a campus at every
 * zoom is not something to download onto a phone plan. So with no signal
 * Leaflet drew what it always draws: nothing. An empty panel with a zoom
 * control in the corner, no word about why, on a screen called Getting there —
 * which reads as a broken app rather than as a map that needs a connection,
 * while today's classes, every room and the official maps below it are all
 * still working.
 *
 * So the map says so, over the top of itself, and stops saying it the moment a
 * tile arrives. Nothing else on the screen changes: this is a caption on one
 * panel, not an offline mode.
 */
export function LiveMap({
  pins,
  centre,
  zoom,
  height = 300,
  selected,
  fit = 0,
}: {
  pins: Pin[];
  centre: { lat: number; lon: number };
  zoom: number;
  height?: number;
  selected?: string | null;
  fit?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  /*
   * Starts true when the browser already says there is no connection, so the
   * explanation is there with the panel rather than a few seconds of blank
   * later. Otherwise it waits to be told by the tiles themselves — which is
   * the honest test, and catches the case the flag never sees: a connection
   * that exists and cannot reach OpenStreetMap.
   */
  const [blank, setBlank] = useState(offline);

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, { zoomControl: true, attributionControl: true }).setView(
      [centre.lat, centre.lon],
      zoom,
    );
    const tiles = L.tileLayer(TILES, { maxZoom: 19, attribution: OSM_CREDIT });
    // One tile that arrives is proof enough that the map is drawing, and one
    // that fails is proof enough that it is not. Leaflet fires these per tile
    // and React drops a set to the value already held, so the pair settles
    // after the first of each rather than re-rendering per tile.
    tiles.on('tileload', () => setBlank(false));
    tiles.on('tileerror', () => setBlank(true));
    tiles.addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    /*
     * Leaflet measures the container on creation, and this one is often still
     * laying out. A tick later it is the right size.
     *
     * Cleared on the way out, and that is not tidiness. Leave for the map
     * inside sixty milliseconds — tap Maps and change your mind, which is a
     * thing people do and which every sweep of this app does dozens of times
     * — and the timer fires after `m.remove()` has taken the map's container
     * out from under it. `invalidateSize` then reads a position that is no
     * longer there:
     *
     *     TypeError: Cannot read properties of undefined (reading '_leaflet_pos')
     *
     * An uncaught error rather than a broken screen, which is why it survived:
     * nothing looks wrong, the map is already gone. But `components/
     * Watching.tsx` listens on `window` for exactly this and files it as a
     * fault, so the app was reporting itself broken for leaving a page early.
     */
    const sized = setTimeout(() => m.invalidateSize(), 60);
    return () => {
      clearTimeout(sized);
      m.remove();
      map.current = null;
      layer.current = null;
    };
    // Centre and zoom are the starting view only; moving the map afterwards is
    // the person's business, so they are deliberately not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * The connection coming back is not something the tiles will report on their
   * own: Leaflet only asks for a tile it has not got, and the failed ones are
   * still in its cache as failed. So a return to signal clears the message and
   * asks for them again — the same redraw a pan would have caused.
   */
  useEffect(
    () =>
      watchConnection((online) => {
        setBlank(!online);
        if (online) map.current?.eachLayer((l) => (l instanceof L.TileLayer ? l.redraw() : undefined));
      }),
    [],
  );

  // Recentre only when told to, never on a re-render.
  useEffect(() => {
    map.current?.setView([centre.lat, centre.lon], zoom);
  }, [centre.lat, centre.lon, zoom]);

  // The map is taller or shorter than it was, and Leaflet has to be told: it
  // caches the container size, so a grown map draws grey where the new tiles go.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const t = setTimeout(() => m.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [height]);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    for (const pin of pins) {
      if (pin.spread && pin.spread > 0) {
        L.circle([pin.lat, pin.lon], {
          radius: pin.spread,
          color: COLOURS[pin.tone],
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.08,
        }).addTo(group);
      }
      const marker = L.marker([pin.lat, pin.lon], {
        icon: iconFor(pin.tone, pin.id === selected, pin.badge),
        title: pin.label,
        // The selected pin is drawn over the others rather than under whichever
        // happened to be added last.
        zIndexOffset: pin.id === selected ? 1000 : 0,
      });
      marker.bindTooltip(escapeHtml(pin.label), { direction: 'top', offset: [0, -10] });
      if (pin.onOpen) marker.on('click', pin.onOpen);
      marker.addTo(group);
    }
  }, [pins, selected]);

  // Fit everything, when asked. Capped at street zoom so a single pin does not
  // fill the screen with one building.
  useEffect(() => {
    const m = map.current;
    if (!m || fit === 0 || pins.length === 0) return;
    m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number])), {
      padding: [30, 30],
      maxZoom: 17,
    });
    // Only the counter. Refitting whenever a pin moved would fight the person's
    // own panning, which is the bug this whole file is careful about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <div
        ref={host}
        role="application"
        aria-label="Map"
        style={{
          height: '100%',
          width: '100%',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          border: '1px solid var(--app-line)',
          background: 'var(--app-panel)',
        }}
      />
      {blank && (
        /* Over the panel rather than in place of it, so the map is still
           there — a tile that arrives while this is up takes it straight
           down, with nothing to re-mount and no pan or zoom thrown away. */
        <div
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            /* Over Leaflet's own furniture too. Its zoom buttons sit at a
               z-index of 1000 and would otherwise float above this, offering
               to zoom in on nothing. The attribution goes with them, and the
               screen prints the same credit under the panel either way. */
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--sp-3)',
            padding: 'var(--sp-7)',
            textAlign: 'center',
            borderRadius: 'var(--r-lg)',
            background: 'var(--app-panel)',
            border: '1px solid var(--app-line)',
          }}
        >
          <span style={{ fontSize: 'var(--type-base)', opacity: 0.75, textWrap: 'pretty' }}>
            The map itself needs a connection.
          </span>
          <span style={{ fontSize: 'var(--type-xs)', opacity: 0.5, textWrap: 'pretty', lineHeight: 'var(--leading-normal)' }}>
            Your classes, your rooms and the official maps are below, and they work
            without one.
          </span>
        </div>
      )}
    </div>
  );
}

const COLOURS: Record<Pin['tone'], string> = {
  you: '#7fb8e8',
  class: '#e0b184',
  saved: '#9fd8b8',
  result: '#c8785f',
};

function iconFor(tone: Pin['tone'], picked: boolean, badge?: string): L.DivIcon {
  const size = picked ? 24 : tone === 'you' ? 14 : 16;
  const ring = picked
    ? 'box-shadow:0 0 0 3px rgba(255,255,255,0.55),0 2px 6px rgba(0,0,0,0.45);'
    : 'box-shadow:0 0 0 1px rgba(255,255,255,0.25);';
  const inside =
    badge && (picked || tone === 'class')
      ? `<span style="position:absolute;inset:0;display:flex;align-items:center;` +
        `justify-content:center;font:600 ${Math.round(size * 0.6)}px/1 system-ui,sans-serif;` +
        `color:rgba(10,11,14,0.9);">${escapeHtml(badge)}</span>`
      : '';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<span style="position:relative;display:block;width:${size}px;height:${size}px;` +
      `border-radius:50%;background:${COLOURS[tone]};border:2px solid rgba(10,11,14,0.85);` +
      `${ring}">${inside}</span>`,
  });
}

/** Popups take HTML, and a building name is not something to trust with that. */
function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
