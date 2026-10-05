import { describe, expect, it } from 'vitest';
import { CONTENT_READINESS } from '../lib/launch/content';
import { CATEGORIES, LABELS, REVIEW_EVERY_DAYS, availabilityOf, freshness, guarantee, guaranteeProblems, needsAttention, nextSteps, problems, reportBroken, verify, type ServiceListing } from './services';

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

describe('the resource guarantee', () => {
  const writing = (over: Partial<ServiceListing> = {}) =>
    listing({ id: 'wc', category: 'writing', name: 'Writing Center', availability: { status: 'closed', note: 'back Oct 3' }, ...over });
  const guide = listing({ id: 'guide', category: 'writing', name: 'Approved writing guide' });

  it('says a closed listing is closed, and offers its owner-chosen fallback first', () => {
    const peer = listing({ id: 'peer', category: 'writing', name: 'Peer tutors', label: 'peer', owner: 'Student Government' });
    const g = guarantee(writing({ fallbackId: 'peer' }), [writing({ fallbackId: 'peer' }), guide, peer], TODAY);
    expect(g.headline).toBe('Writing Center is currently closed: back Oct 3.');
    expect(g.alternatives.map((a) => [a.listing.id, a.why])).toEqual([['peer', 'owner-fallback'], ['guide', 'same-category']]);
    expect(g.deadEnd).toBe(false);
    expect(g.canReport).toBe(true);
  });

  it('never offers itself, a closed listing or an incomplete one', () => {
    const closed = listing({ id: 'c', category: 'writing', availability: { status: 'closed', note: '' } });
    const incomplete = listing({ id: 'i', category: 'writing', owner: '' });
    const g = guarantee(writing(), [writing(), closed, incomplete], TODAY);
    expect(g.alternatives).toEqual([]);
    expect(g.deadEnd).toBe(true);
  });

  it('is not a dead end when the listing is open, even with nothing else to offer', () => {
    const g = guarantee(writing({ availability: { status: 'open', note: '' } }), [writing()], TODAY);
    expect(g.headline).toBe('');
    expect(g.deadEnd).toBe(false);
  });

  it('reports a listing with no stated availability as unknown, not open', () => {
    expect(availabilityOf(listing(), TODAY)).toBe('unknown');
  });

  it('lets a closure lapse once its end date has passed, rather than say it forever', () => {
    expect(availabilityOf(writing({ availability: { status: 'closed', note: '', until: '2026-09-20' } }), TODAY)).toBe('unknown');
    expect(availabilityOf(writing({ availability: { status: 'closed', note: '', until: '2026-10-03' } }), TODAY)).toBe('closed');
  });

  it('names a waitlist without calling it closed, and still offers alternatives', () => {
    const g = guarantee(writing({ availability: { status: 'waitlist', note: '2 weeks' } }), [writing(), guide], TODAY);
    expect(g.headline).toBe('Writing Center has a waitlist: 2 weeks.');
    expect(g.alternatives.map((a) => a.listing.id)).toEqual(['guide']);
  });

  it('tells the owning office what is wrong with a fallback', () => {
    const a = writing({ fallbackId: 'wc' });
    expect(guaranteeProblems(a, [a, guide], TODAY)).toContain('its fallback is itself');
    const b = writing({ fallbackId: 'nowhere' });
    expect(guaranteeProblems(b, [b, guide], TODAY)).toContain('its fallback does not exist');
    const c = writing({ fallbackId: 'bad' });
    expect(guaranteeProblems(c, [c, listing({ id: 'bad', owner: '' })], TODAY)).toContain('its fallback is incomplete');
    const d = writing({ fallbackId: 'guide' });
    const loop = { ...guide, fallbackId: 'wc' };
    expect(guaranteeProblems(d, [d, loop], TODAY)).toContain('its fallback leads back to it');
    const dead = writing();
    expect(guaranteeProblems(dead, [dead], TODAY)).toContain('it is closed and there is nothing to offer instead');
    expect(guaranteeProblems(writing({ availability: { status: 'open', note: '' } }), [guide], TODAY)).toEqual([]);
  });
});
