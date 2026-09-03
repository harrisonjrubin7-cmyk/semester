import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OSM_CREDIT, TILES } from '../lib/findplace';

export interface Pin {
  id: string;
  lat: number;
  lon: number;
  label: string;
  /** Decides the marker's look: where you are, where you have to be, or a hit. */
  tone: 'you' | 'class' | 'saved' | 'result';
  onOpen?: () => void;
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
 */
export function LiveMap({
  pins,
  centre,
  zoom,
  height = 300,
}: {
  pins: Pin[];
  centre: { lat: number; lon: number };
  zoom: number;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, { zoomControl: true, attributionControl: true }).setView(
      [centre.lat, centre.lon],
      zoom,
    );
    L.tileLayer(TILES, { maxZoom: 19, attribution: OSM_CREDIT }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // Leaflet measures the container on creation, and this one is often still
    // laying out. A tick later it is the right size.
    setTimeout(() => m.invalidateSize(), 60);
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
    // Centre and zoom are the starting view only; moving the map afterwards is
    // the person's business, so they are deliberately not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre only when told to, never on a re-render.
  useEffect(() => {
    map.current?.setView([centre.lat, centre.lon], zoom);
  }, [centre.lat, centre.lon, zoom]);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lon], { icon: iconFor(pin.tone), title: pin.label });
      marker.bindPopup(escapeHtml(pin.label));
      if (pin.onOpen) marker.on('click', pin.onOpen);
      marker.addTo(group);
    }
  }, [pins]);

  return (
    <div
      ref={host}
      role="application"
      aria-label="Map"
      style={{
        height,
        width: '100%',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
      }}
    />
  );
}

const COLOURS: Record<Pin['tone'], string> = {
  you: '#7fb8e8',
  class: '#d4d9e2',
  saved: '#9fd8b8',
  result: '#c8785f',
};

function iconFor(tone: Pin['tone']): L.DivIcon {
  const size = tone === 'you' ? 14 : 16;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;` +
      `background:${COLOURS[tone]};border:2px solid rgba(10,11,14,0.85);` +
      `box-shadow:0 0 0 1px rgba(255,255,255,0.25);"></span>`,
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
