/**
 * Dining locations, their hours and their menus.
 *
 * Hours are weekly windows in the location's own time zone, in minutes from
 * local midnight, so "open 07:00–10:30 on weekdays" is five rows and a late
 * night that crosses midnight is two (the evening one ends at 1440, the next
 * day's starts at 0). A window is half-open: open at `opensAt`, closed at
 * `closesAt`. That is the rule the SQL uses too.
 *
 * Every location, hour set and menu item carries a source label and the time
 * it was last true, because a menu from last Tuesday's feed is not today's
 * menu and a student deciding where to walk needs to know which one they are
 * reading. Nothing here is written by a student.
 */
import { figure, type Figure } from './figures';
import { no, yes, type Decision } from './decision';
import { localParts } from './time';
import { sourceLine, type SourceLabel } from '../source';

export interface HoursWindow {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes from local midnight, inclusive. */
  opensAt: number;
  /** Minutes from local midnight, exclusive; at most 1440. */
  closesAt: number;
}

export interface DiningLocation {
  id: string;
  tenantId: string;
  name: string;
  timeZone: string;
  hours: readonly HoursWindow[];
  /** Mobile orders that may be open (placed, accepted or ready) at once. */
  capacity: number;
  /** Staff can pause ordering at one location without touching the flag. */
  orderingEnabled: boolean;
  source: SourceLabel;
  /** When the hours were last true according to their source, epoch ms. */
  sourceAt: number | null;
}

export interface MenuItem {
  id: string;
  locationId: string;
  /** The local date it is served. */
  servedOn: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'late' | 'all_day';
  name: string;
  priceCents: number;
  /** Whether a meal swipe covers it. */
  swipeEligible: boolean;
  available: boolean;
  source: SourceLabel;
  sourceAt: number | null;
}

export function validHours(h: HoursWindow): boolean {
  return (
    Number.isInteger(h.weekday) && h.weekday >= 0 && h.weekday <= 6 &&
    Number.isInteger(h.opensAt) && Number.isInteger(h.closesAt) &&
    h.opensAt >= 0 && h.closesAt <= 1440 && h.opensAt < h.closesAt
  );
}

/** Whether a location is open at an instant, and which window says so. */
export function openAt(location: DiningLocation, now: number): Decision<HoursWindow> {
  const { weekday, minutes } = localParts(now, location.timeZone);
  const window = location.hours.find(
    (h) => validHours(h) && h.weekday === weekday && minutes >= h.opensAt && minutes < h.closesAt,
  );
  if (!window) {
    return no('closed', `${location.name} is closed now (${sourceLine(location.source, location.sourceAt, now)} hours).`);
  }
  return yes(window, `${location.name} is open until ${clock(window.closesAt)}.`);
}

export function clock(minutes: number): string {
  const m = minutes % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface MenuLine {
  item: MenuItem;
  price: Figure;
}

/**
 * Today's menu at a location, each price with its source and age. Items not
 * served today, or marked unavailable, are left out rather than shown struck
 * through: a student cannot order them.
 */
export function menuToday(location: DiningLocation, items: readonly MenuItem[], now: number): MenuLine[] {
  const today = localParts(now, location.timeZone).date;
  return items
    .filter((i) => i.locationId === location.id && i.servedOn === today && i.available)
    .map((item) => ({ item, price: figure(item.priceCents, 'cents', item.source, item.sourceAt, now) }));
}
