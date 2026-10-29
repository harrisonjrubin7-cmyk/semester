import { test, eq } from './harness';
import { buildSnapshot, safeToStore, RESEARCH_CODE_VERSION } from '../src/lib/researchRules';

const raw = { members_by_role: [{ label: 'Student', value: 120 }, { label: 'Faculty', value: 4 }, { label: 'Staff', value: 15 }], payment_plans: [{ label: 'Approved', value: 3 }] };

test('only the named metrics are built', () => eq(buildSnapshot({ metrics: ['members_by_role'] }, raw, []).tables.map((t) => t.key), ['members_by_role']));
test('small cells and their complement are suppressed', () => eq(buildSnapshot({ metrics: ['members_by_role'] }, raw, []).tables[0].cells.map((c) => c.display), ['120', '<10', 'suppressed']));
test('a metric whose only cell is small hides the total too', () => eq(buildSnapshot({ metrics: ['payment_plans'] }, raw, []).tables[0].totalDisplay, '<10'));
test('a small cohort shows only as <10', () => eq(buildSnapshot({ metrics: [], cohorts: ['c1', 'c2'] }, raw, [{ id: 'c1', title: 'Fall students', size: 7 }, { id: 'c2', title: 'All', size: 40 }, { id: 'c3', title: 'Unused', size: 99 }]).tables.map((t) => t.cells[0].display), ['<10', '40']));
test('every built snapshot is safe to store', () => eq(safeToStore(buildSnapshot({ metrics: ['members_by_role', 'payment_plans'], cohorts: ['c1'] }, raw, [{ id: 'c1', title: 'x', size: 3 }])), true));
test('control: an unsuppressed small cell is not safe', () => eq(safeToStore({ tables: [{ key: 'x', label: 'x', cells: [{ label: 'a', value: 3, display: '3', suppressed: false }], total: null, totalDisplay: '' }] }), false));
test('code version pins metric versions and the minimum', () => eq(RESEARCH_CODE_VERSION.includes('members_by_role@1') && RESEARCH_CODE_VERSION.endsWith('min=10'), true));
