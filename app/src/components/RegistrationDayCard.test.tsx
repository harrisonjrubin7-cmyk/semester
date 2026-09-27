// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { REGISTRATION_DAY_KEY, EMPTY_REGISTRATION_DAY, type RegistrationDayData } from '../lib/registration-day';
import { REGISTRATION_KEY } from '../lib/registration-plan';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { TodayDecisionSurface } from './TodayDecisionSurface';

/**
 * Registration Day Mode on Today, driven the way a student meets it: the card
 * appears in the week before the window (or when they switch it on), reads
 * like the brief, copies references, and hands off to the official system
 * only through a confirmation. With the flag off, Today is untouched.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const NOW = new Date(2027, 3, 1, 10, 17, 42);
const section = (id: string, code: string, days: number[], start: number, end: number, crn?: string) => ({
  id, code, section: '01', title: `${code} title`, term: 'Spring 2027', department: code.split(' ')[0], credits: code === 'STAT 101' ? 4 : 3,
  instructor: '', location: '', description: '', prerequisites: '', seats: 10, meetings: [{ days, start, end }],
  ...(crn ? { crn } : {}),
});
const COURSES = [
  section('psy', 'PSY 220', [1, 3], 540, 590, '40123'),
  section('stat', 'STAT 101', [2, 4], 540, 615),
  section('eng', 'ENG 201', [5], 600, 750),
  section('econ', 'ECON 120', [2, 4], 780, 850),
  section('phil', 'PHIL 115', [2, 4], 900, 950),
];

const seed = (plan: Partial<RegistrationDayData>) => {
  localStorage.setItem(REGISTRATION_KEY, JSON.stringify({
    catalog: { institution: 'Example University', importedAt: '2027-03-30T12:00:00.000Z', courses: COURSES },
    cart: ['psy', 'stat', 'eng'],
    plans: [],
  }));
  localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify({ ...EMPTY_REGISTRATION_DAY, ...plan }));
};

beforeAll(async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  await loadSeed();
  // Today loads these lazily (`TodayDecisionSurface`); loaded once here so a
  // mount only has to wait for React, not for the module.
  await import('./TodayActionCenter');
  await import('./RegistrationDayCard');
});
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mount = async (flags: { registrationDay: boolean; actionCenter?: boolean }) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <TodayDecisionSurface actionCenter={flags.actionCenter ?? false} registrationDay={flags.registrationDay} />
      </StoreProvider>,
    );
  });
  // One more turn for the lazy boundary to swap its fallback for the surface.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const card = () => host.querySelector('.regday-card');
const text = (el: Element | null = host) => (el?.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp) => {
  const found = [...host.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}`);
  return found;
};

describe('Registration Day Mode on Today', () => {
  it('is not there with the flag off, even on the day', async () => {
    seed({ opensAt: '2027-04-01T12:00' });
    await mount({ registrationDay: false });
    expect(card()).toBeNull();
    expect(host.querySelector('.today-decision-surface')).not.toBeNull();
  });

  it('follows the registration_day_mode flag, which no build variable sets here', async () => {
    seed({ opensAt: '2027-04-01T12:00' });
    await act(async () => {
      root.render(
        <StoreProvider>
          <TodayDecisionSurface />
        </StoreProvider>,
      );
    });
    expect(card()).toBeNull();
  });

  it('is not there a month out', async () => {
    seed({ opensAt: '2027-05-01T08:00' });
    await mount({ registrationDay: true });
    expect(card()).toBeNull();
  });

  it('appears a month out when the student switches it on', async () => {
    seed({ opensAt: '2027-05-01T08:00', manual: true });
    await mount({ registrationDay: true });
    expect(card()).not.toBeNull();
    expect(text(card())).toContain('Opens in 29 days, 21 hours.');
  });

  it('reads like the brief in the last day: a ticking clock, the three lines, the plan and its backups', async () => {
    seed({ opensAt: '2027-04-01T12:00', backups: { psy: ['econ', 'phil'] } });
    await mount({ registrationDay: true });
    expect(host.querySelector('.regday-card [role="timer"]')?.textContent).toBe('01:42:18');
    expect([...card()!.querySelectorAll('.regday-card-lines li')].map((li) => text(li))).toEqual([
      '✓Ready: 10 credits selected',
      '✓Ready: No schedule conflicts',
      '!Needs attention: 2 backup options needed',
    ]);
    const backups = card()!.querySelector('.regday-card-backups')!;
    expect(text(backups)).toMatch(/^If PSY 220 is unavailable:/);
    expect([...backups.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['ECON 120 01', 'PHIL 115 01']);
    expect(text(card())).toMatch(/Student entered/);
    expect(text(card())).toMatch(/Imported/);
    expect(text(card())).toContain('Semester never registers you');
  });

  it('copies course references, with the CRN where the catalog has one', async () => {
    seed({ opensAt: '2027-04-01T12:00' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await mount({ registrationDay: true });
    await act(async () => button(/^Copy course references$/).click());
    expect(writeText).toHaveBeenCalledWith(
      'PSY 220 01 · CRN 40123\nSTAT 101 01 · reference number not in your catalog\nENG 201 01 · reference number not in your catalog',
    );
    expect(host.querySelector('.regday-card [role="status"]')?.textContent).toContain('Nothing was submitted');
  });

  it('opens the official system only after a confirmation that starts on Cancel', async () => {
    seed({ opensAt: '2027-04-01T12:00', portalUrl: 'https://register.example.edu/' });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    await mount({ registrationDay: true });
    await act(async () => button(/^Open official registration system$/).click());
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(text(dialog)).toContain('https://register.example.edu/');
    expect(text(dialog)).toContain('You are leaving Semester');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(open).not.toHaveBeenCalled();
    await act(async () => button(/^Open in a new tab$/).click());
    expect(open).toHaveBeenCalledWith('https://register.example.edu/', '_blank', 'noopener,noreferrer');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('asks for the address instead of inventing one', async () => {
    seed({ opensAt: '2027-04-01T12:00' });
    await mount({ registrationDay: true });
    expect(text(card())).toContain('Add your registration system’s address');
    expect(text(card())).not.toContain('Open official registration system');
  });

  it('puts registration readiness into the Action Center while the mode shows', async () => {
    seed({ opensAt: '2027-04-01T12:00' });
    await mount({ registrationDay: true, actionCenter: true });
    // Three sections, none backed, less than three days out: critical, so first.
    expect(host.querySelector('#action-top-title')?.textContent).toMatch(/^Choose a backup for /);
    await mount({ registrationDay: false, actionCenter: true });
    expect(text()).not.toMatch(/Choose a backup for/);
  });
});
