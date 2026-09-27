import { useNow } from '../state/store';
import { SectionLabel } from './ui';
import { useSchoolRecords } from '../lib/school-records-hook';
import { FRESHNESS_TEXT } from '../lib/integration/freshness';
import { clock } from '../lib/date';
import { quietFirst, roomsNow } from '../lib/room-availability';

/**
 * "Rooms free now" on Support › Campus — from the school's booking system,
 * under the same flag and consent as every other school fact. Draws nothing
 * until the school shares at least one room.
 */
export function RoomsNow({ sensory }: { sensory: boolean }) {
  const now = useNow();
  const school = useSchoolRecords('rooms');
  if (school.status !== 'ready') return null;
  const rooms = roomsNow(school.rows, now);
  if (!rooms.length) return null;
  const shown = sensory ? quietFirst(rooms) : rooms;
  return (
    <section aria-label="Rooms free now">
      <SectionLabel>Rooms free now</SectionLabel>
      {shown.map((r) => (
        <div key={r.space} className="jx-entry">
          <div className="jx-entry-head">
            <span className="jx-entry-title">{r.space}</span>
            {r.quiet ? <span className="jx-tag">Quiet</span> : null}
          </div>
          <div className="jx-entry-what">
            {r.status === 'free_now' ? `Free until ${clock(r.at!)}` : r.status === 'free_later' ? `Free from ${clock(r.at!)}` : r.status === 'busy_now' ? `Booked until ${clock(r.at!)}; no free time listed after` : 'No availability listed for the rest of today'}
          </div>
          <div className="jx-privacy">
            {FRESHNESS_TEXT[r.freshness]} · from the school’s booking system
            {r.freshness === 'stale' ? ' · may already be taken' : ''}
          </div>
          {r.bookUrl ? (
            <a className="jx-door-link" href={r.bookUrl} target="_blank" rel="noopener noreferrer">Book on the school’s page ↗</a>
          ) : null}
        </div>
      ))}
      <p className="jx-muted">Semester shows availability; it books nothing. Booking happens on your school’s page.</p>
    </section>
  );
}
