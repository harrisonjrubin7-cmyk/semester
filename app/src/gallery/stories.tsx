import type { ReactNode } from 'react';
import { fromSourceLabel, fromWhere, type FactProvenance } from '../lib/factprovenance';
import { ProvenanceChips } from '../components/unity/ProvenanceChips';
import { Table, type Column } from '../components/unity/Table';
import { Combobox } from '../components/unity/Combobox';
import { DateField } from '../components/unity/DateField';
import { ActionPreview } from '../components/unity/ActionPreview';
import { ObjectCard } from '../components/unity/ObjectCard';

/**
 * The design system's stable components, drawn in the states that matter.
 *
 * One list, read by three things: `pages.tsx` (renders it to static HTML under
 * a chosen ground), `scripts/gallery-shots.mjs` (screenshots those pages and
 * compares them with a baseline) and `gallery.test.tsx` (every story renders,
 * and every component in `components/unity/` has a story or says why not).
 *
 * Static on purpose. A story is markup at one moment, so the screenshots
 * cannot depend on a timer, a network or the store. Behaviour is the
 * component's own test; this is what it looks like.
 *
 * A fixed `now` is passed to anything that draws an age, so "2 hours ago" is
 * the same two hours in every run.
 */
export const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface Story {
  id: string;
  /** The file in `components/unity/` this story draws, without the extension. */
  component: string;
  title: string;
  render: () => ReactNode;
}

interface Grade {
  id: string;
  name: string;
  score: number | null;
}
const GRADES: Grade[] = [
  { id: 'a', name: 'Problem set 1', score: 9 },
  { id: 'b', name: 'Midterm', score: 71 },
  { id: 'c', name: 'Problem set 2', score: null },
];
const COLUMNS: Column<Grade>[] = [
  { id: 'name', header: 'Item', cell: (r) => r.name, rowHeader: true, sortable: true },
  { id: 'score', header: 'Score', cell: (r) => (r.score === null ? '—' : String(r.score)), numeric: true, sortable: true },
];

const CHIPS: Array<[string, FactProvenance]> = [
  ['Official, current', fromSourceLabel('institution_verified', { authority: 'Registrar', at: NOW - 2 * HOUR, maxAgeMs: DAY, now: NOW })],
  ['Official, out of date', fromSourceLabel('institution_verified', { authority: 'Registrar', at: NOW - 5 * DAY, maxAgeMs: DAY, now: NOW })],
  ['Imported', fromSourceLabel('imported')],
  ['You entered it', fromSourceLabel('student_entered')],
  ['Estimated', fromSourceLabel('estimated')],
  ['Needs review', fromSourceLabel('needs_review')],
  ['AI-assisted', fromSourceLabel('ai_assisted')],
  ['Connected system', fromWhere('connected', { system: 'Brightspace', at: NOW - HOUR })],
  ['Sample data', fromWhere('sample')],
  [
    'Official, restricted, pending',
    { origin: 'official', authority: 'Registrar', assurance: 'verified', freshness: 'current', observedAt: NOW - HOUR, access: 'restricted', controller: 'the Registrar', lifecycle: 'pending', owner: 'Dean’s office' },
  ],
];

const noop = () => undefined;

export const STORIES: Story[] = [
  {
    id: 'provenance-chips',
    component: 'ProvenanceChips',
    title: 'Provenance chips',
    render: () => (
      <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
        {CHIPS.map(([name, p]) => (
          <div key={name} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 220px) 1fr', gap: 'var(--sp-6)', alignItems: 'baseline' }}>
            <span style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>{name}</span>
            <ProvenanceChips provenance={p} now={NOW} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'table',
    component: 'Table',
    title: 'Table, scrolling and stacked',
    render: () => (
      <div style={{ display: 'grid', gap: 'calc(20px * var(--text-scale, 1))' }}>
        <Table caption="Released grades" columns={COLUMNS} rows={GRADES} rowKey={(r) => r.id} sort={{ id: 'score', dir: 'descending' }} onSort={noop} empty={<p>No grades yet.</p>} />
        <Table caption="Released grades, stacked" columns={COLUMNS} rows={GRADES} rowKey={(r) => r.id} compact="stack" empty={<p>No grades yet.</p>} />
        <Table caption="Nothing released" columns={COLUMNS} rows={[]} rowKey={(r) => r.id} empty={<p>No grades yet. They appear here when your instructor releases them.</p>} />
      </div>
    ),
  },
  {
    id: 'combobox',
    component: 'Combobox',
    title: 'Combobox, closed',
    render: () => (
      <Combobox label="Find a course" value="" onValueChange={noop} options={[]} onChoose={noop} placeholder="Course, code or instructor">
        Type to see matches.
      </Combobox>
    ),
  },
  {
    id: 'date-field',
    component: 'DateField',
    title: 'Date field, plain and with a complaint',
    render: () => (
      <div style={{ display: 'grid', gap: 'var(--sp-7)' }}>
        <DateField label="Due date" value="2026-10-12" onChange={noop} hint="The day it is due." />
        <DateField label="Return date" value="" onChange={noop} required error="Choose the day you are coming back." />
      </div>
    ),
  },
  {
    id: 'action-preview',
    component: 'ActionPreview',
    title: 'Action preview, each recovery',
    render: () => (
      <div style={{ display: 'grid', gap: 'calc(20px * var(--text-scale, 1))' }}>
        <ActionPreview subject="Spring schedule" says="Sends a copy of your schedule to your advisor." doesNotChange="Your registration." recovery={{ kind: 'undo', how: 'Remove the share in Settings.' }} />
        <ActionPreview subject="Draft essay" says="Submits the draft to your instructor." subjectTo="Your instructor’s deadline." recovery={{ kind: 'request', how: 'ask your instructor to reopen it.' }} whoCanHelp="Your instructor, or the Help desk." provenance={fromSourceLabel('student_entered')} />
        <ActionPreview subject="Course" says="Deletes the course and its notes." recovery={{ kind: 'none' }} />
      </div>
    ),
  },
  {
    id: 'object-card',
    component: 'ObjectCard',
    title: 'Object card with provenance',
    render: () => (
      <ObjectCard
        kind="assignment"
        title="Midterm"
        explanation="Covers chapters 1 to 6."
        metadata="Thursday, 9:00 a.m."
        now={NOW}
        provenance={fromSourceLabel('institution_verified', { authority: 'Registrar', at: NOW - 2 * HOUR, maxAgeMs: DAY, now: NOW })}
      />
    ),
  },
];
