import { test, eq } from './harness';
import { decide, slugify, PubState } from '../src/lib/pubRules';

const post = (o: Partial<PubState> = {}): PubState => ({ status: 'Draft', authorId: 'a', body: 'A body long enough to submit.', claimTypes: [], claimSources: '', slug: 'x', ...o });
const reason = (d: ReturnType<typeof decide>) => (d.ok ? 'OK:' + d.next : d.reason);

test('author submits a clean draft', () => eq(reason(decide('submit', post(), 'a')), 'OK:In review'));
test('claim without source cannot be submitted', () => eq(decide('submit', post({ claimTypes: ['Price'] }), 'a').ok, false));
test('claim with source can be submitted', () => eq(decide('submit', post({ claimTypes: ['Price'], claimSources: 'Source Register #12' }), 'a').ok, true));
test('empty body cannot be submitted', () => eq(decide('submit', post({ body: 'short' }), 'a').ok, false));
test('author cannot approve own post', () => eq(decide('approve', post({ status: 'In review' }), 'a').ok, false));
test('another person can approve', () => eq(reason(decide('approve', post({ status: 'In review' }), 'b')), 'OK:Approved'));
test('request changes needs a note', () => eq(decide('requestChanges', post({ status: 'In review' }), 'b', { note: '' }).ok, false));
test('drafts cannot be approved directly', () => eq(decide('approve', post(), 'b').ok, false));
test('only approved posts publish', () => eq(decide('publish', post({ status: 'In review' }), 'b').ok, false));
test('author cannot publish own post', () => eq(decide('publish', post({ status: 'Approved' }), 'a').ok, false));
test('slug clash blocks publish', () => eq(decide('publish', post({ status: 'Approved' }), 'b', { slugTakenByOther: true }).ok, false));
test('non-author publishes approved post', () => eq(reason(decide('publish', post({ status: 'Approved' }), 'b')), 'OK:Published'));
test('published posts cannot be edited', () => eq(decide('save', post({ status: 'Published' }), 'a').ok, false));
test('published posts can be withdrawn', () => eq(reason(decide('withdraw', post({ status: 'Published' }), 'a')), 'OK:Withdrawn'));
test('slugify', () => eq(slugify('  Our Pilot: Fall 2026! '), 'our-pilot-fall-2026'));
