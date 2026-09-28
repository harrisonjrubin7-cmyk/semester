import { describe, expect, it } from 'vitest';
import { CONTENT_READINESS } from '../lib/launch/content';
import { CATEGORIES, LABELS, REVIEW_EVERY_DAYS, freshness, needsAttention, nextSteps, problems, reportBroken, verify, type ServiceListing } from './services';

const TODAY = '2026-09-28';
const listing = (over: Partial<ServiceListing> = {}): ServiceListing => ({
  id: 'l1', category: 'tutoring', name: 'Tutoring Center', owner: 'Academic Support', label: 'official', eligibility: 'Everyone enrolled', cost: 'Free',
  hours: 'Mon–Fri 9–5', accessibility: 'Step-free; ASL on request', languages: ['English', 'Spanish'], appointmentRoute: 'Book online', location: 'Library, 2nd floor',
  url: 'https://tutoring.example.edu', verifiedOn: '2026-09-15', brokenReports: 0, ...over,
});

describe('a listing', () => {
  it('covers the fifteen categories and the three labels', () => {
    expect(CATEGORIES).toHaveLength(15);
    expect(Object.keys(LABELS)).toEqual(['official', 'partner', 'peer']);
  });

  it('is complete only with every field the blueprints require', () => {
    expect(problems(listing())).toEqual([]);
    const p = problems(listing({ owner: '', eligibility: '', cost: '', hours: '', accessibility: '', languages: [], appointmentRoute: '', location: '', url: 'http://x', verifiedOn: 'last spring' }));
    expect(p).toEqual(['an owner', 'eligibility, even "everyone"', 'cost, even "free"', 'hours', 'accessibility details', 'at least one language', 'how to get an appointment', 'a location, even "online"', 'an https link, or none', 'a last-verified date']);
  });

  it('is verified on the same window content governance gives campus services', () => {
    const row = CONTENT_READINESS.find((c) => c.id === 'campus_services');
    expect(row?.reviewEveryDays).toBe(REVIEW_EVERY_DAYS);
    expect(freshness(listing(), TODAY)).toBe('fresh');
    expect(freshness(listing({ verifiedOn: '2026-07-05' }), TODAY)).toBe('due');
    expect(freshness(listing({ verifiedOn: '2026-06-01' }), TODAY)).toBe('stale');
    expect(freshness(verify(listing({ verifiedOn: '2026-06-01', brokenReports: 2 }), TODAY), TODAY)).toBe('fresh');
    expect(verify(listing({ brokenReports: 2 }), TODAY).brokenReports).toBe(0);
  });
});

describe('"I need help with"', () => {
  it('answers with complete listings, official first, stale last, each with its source line', () => {
    const out = nextSteps('tutoring', [
      listing({ id: 'peer', name: 'Peer tutors', label: 'peer', owner: 'Student Government' }),
      listing({ id: 'stale', name: 'Old center', verifiedOn: '2026-01-01' }),
      listing({ id: 'partner', name: 'Khan', label: 'partner', owner: 'Vendor' }),
      listing({ id: 'incomplete', owner: '' }),
      listing({ id: 'other', category: 'writing' }),
      listing(),
    ], TODAY);
    expect(out.map((s) => s.listing.id)).toEqual(['l1', 'stale', 'partner', 'peer']);
    expect(out[0].sourceLine).toBe('Official campus service · Academic Support · verified 2026-09-15');
    expect(out[1].freshness).toBe('stale');
  });

  it('shows eligibility as written and never evaluates it', () => {
    const [s] = nextSteps('tutoring', [listing({ eligibility: 'Juniors and seniors only' })], TODAY);
    expect(s.listing.eligibility).toBe('Juniors and seniors only');
    expect(Object.keys(s)).toEqual(['listing', 'freshness', 'sourceLine']);
  });

  it('the institution sees what needs attention — stale, reported or incomplete — and never a student', () => {
    const l = [listing(), listing({ id: 's', verifiedOn: '2026-01-01' }), reportBroken(listing({ id: 'b' })), listing({ id: 'i', hours: '' })];
    expect(needsAttention(l, TODAY).map((x) => x.id)).toEqual(['s', 'b', 'i']);
  });
});
