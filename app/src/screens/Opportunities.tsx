import { useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { SectionLabel, TabList } from '../components/ui';
import { Card, Checklist, GoTo, Never, OfficeDoor } from '../components/JourneyKit';
import { MentorFinder } from '../components/MentorFinder';
import { VerifiedListings } from '../components/VerifiedListings';
import { useDeviceLibrary } from '../lib/device-library';
import { hasMode } from '../lib/accessmode';
import { dateToIso } from '../lib/date';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionPreview } from '../components/unity/ActionPreview';
import {
  ABROAD_NOTICE,
  EMPTY_OPPORTUNITIES,
  IRB_NOTICE,
  KINDS,
  STAGES,
  TEMPLATES,
  deadlines,
  newEvidence,
  newOpportunity,
  newReference,
  readOpportunities,
  resumeBullets,
  skillMap,
  stepProgress,
  timeBudget,
  type Kind,
  type Opportunity,
  type OpportunityLibrary,
  type OpportunityStage,
  type TimeBudget,
} from '../lib/opportunities';

/**
 * Jobs, research, study abroad, credentials, placements, funding and alumni —
 * one tracker, each kind with its own office-ordered checklist.
 *
 * The rules are in `lib/opportunities.ts`. The screen's share of them: the
 * work-study flag is drawn only inside the editor, labelled private; visa and
 * ethics-review steps carry their notices inline; and the resume view reads
 * only evidence the student ticked as ready.
 */

const TABS = [
  { id: 'list' as const, label: 'Tracker' },
  { id: 'time' as const, label: 'Time' },
  { id: 'resume' as const, label: 'Resume & skills' },
];

type Tab = (typeof TABS)[number]['id'];

export function Opportunities() {
  const { account } = useStore();
  return <Workspace key={account?.id || 'device'} storageKey={`semester.opportunities.v1:${account?.id || 'device'}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const lib = useDeviceLibrary(storageKey, readOpportunities, EMPTY_OPPORTUNITIES);
  const [tab, setTab] = useState<Tab>('list');
  const [editing, setEditing] = useState('');
  const update = (fn: (o: OpportunityLibrary) => OpportunityLibrary) => lib.update(fn);
  const selected = lib.value.items.find((o) => o.id === editing);

  return (
    <Page blurb="Campus jobs, research, study abroad, certificates, internships, scholarships and alumni mentors — one list, each with the steps its office works through.">
      <TabList label="Opportunities" className="portal-tabs" value={tab} onChange={(t) => { setEditing(''); setTab(t); }} tabs={TABS} />
      {lib.error ? <p className="jx-warn" role="alert">{lib.error}</p> : null}
      {tab === 'list' && selected ? (
        <Editor
          item={selected}
          onChange={(next) => update((old) => ({ ...old, items: old.items.map((o) => (o.id === next.id ? next : o)) }))}
          onDelete={() => {
            update((old) => ({ ...old, items: old.items.filter((o) => o.id !== selected.id) }));
            setEditing('');
          }}
          onDone={() => setEditing('')}
        />
      ) : null}
      {tab === 'list' && !selected ? (
        <List
          lib={lib.value}
          onTrack={(o) => update((old) => ({ ...old, items: [o, ...old.items] }))}
          onAdd={(kind) => {
            const o = newOpportunity(kind);
            update((old) => ({ ...old, items: [o, ...old.items] }));
            setEditing(o.id);
          }}
          onOpen={setEditing}
        />
      ) : null}
      {tab === 'time' ? <Time budget={lib.value.budget} items={lib.value.items} onChange={(budget) => update((old) => ({ ...old, budget }))} /> : null}
      {tab === 'resume' ? <Resume items={lib.value.items} /> : null}
    </Page>
  );
}

function List({ lib, onAdd, onOpen, onTrack }: { lib: OpportunityLibrary; onAdd: (k: Kind) => void; onOpen: (id: string) => void; onTrack: (o: Opportunity) => void }) {
  const now = useNow();
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const today = dateToIso(now);
  const soon = deadlines(lib.items, today).slice(0, 3);
  const shown = lib.items.filter((o) => kind === 'all' || o.kind === kind);
  return (
    <>
      {soon.length ? (
        <Card kicker="Next deadlines">
          {soon.map((o) => (
            <button key={o.id} type="button" className="jx-rowbtn" onClick={() => onOpen(o.id)}>
              <span>{o.title || KINDS.find((k) => k.id === o.kind)!.label}</span>
              <span className="jx-muted">{o.deadline}</span>
            </button>
          ))}
        </Card>
      ) : null}

      <div className="jx-chips" role="radiogroup" aria-label="Show">
        {[{ id: 'all' as const, plural: 'All' }, ...KINDS].map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`jx-chip${kind === k.id ? ' jx-chip-on' : ''}`} onClick={() => setKind(k.id)}>
            {k.plural}
          </button>
        ))}
      </div>

      {shown.map((o) => {
        const p = stepProgress(o);
        return (
          <button key={o.id} type="button" className="jx-entry jx-entry-button" onClick={() => onOpen(o.id)}>
            <span className="jx-entry-head">
              <span className="jx-entry-title">{o.title || 'Untitled'}</span>
              <span className="jx-tag">{KINDS.find((k) => k.id === o.kind)!.label}</span>
              <span className="jx-tag">{o.stage}</span>
            </span>
            <span className="jx-entry-what">
              {[o.org, o.deadline && `due ${o.deadline}`, `${p.done} of ${p.of} steps`].filter(Boolean).join(' · ')}
            </span>
          </button>
        );
      })}
      {!shown.length ? <p className="jx-muted">Nothing here yet. Add the first one below.</p> : null}

      {kind === 'all' || kind === 'alumni' ? (
        <MentorFinder kind="alumni" interests={[]} fallback={null} />
      ) : null}

      <VerifiedListings onTrack={onTrack} tracked={lib.items.flatMap((o) => [o.id, o.source]).filter(Boolean)} />

      <SectionLabel>Add</SectionLabel>
      <div className="jx-chips">
        {KINDS.map((k) => (
          <button key={k.id} type="button" className="jx-chip" onClick={() => onAdd(k.id)}>
            + {k.label}
          </button>
        ))}
      </div>
      <Never
        items={[
          'Eligibility is decided by the office that runs it — never computed here.',
          'Work-study status stays private to you and is never shown or exported.',
          'Nothing is sent to an employer, lab, program or office.',
        ]}
      />
    </>
  );
}

function Editor({ item: o, onChange, onDelete, onDone }: { item: Opportunity; onChange: (o: Opportunity) => void; onDelete: () => void; onDone: () => void }) {
  const { state } = useStore();
  const chunk = hasMode(state.access, 'chunk');
  const [ev, setEv] = useState('');
  const [ref, setRef] = useState('');
  const [skill, setSkill] = useState('');
  const [deleting, setDeleting] = useState(false);
  const set = (patch: Partial<Opportunity>) => onChange({ ...o, ...patch });
  const kind = KINDS.find((k) => k.id === o.kind)!;

  return (
    <>
      <button type="button" className="jx-go" onClick={onDone}>
        ← All opportunities
      </button>
      <Card kicker={kind.label}>
        <label className="jx-field">
          <span>Title</span>
          <input className="input" value={o.title} onChange={(e) => set({ title: e.target.value })} aria-label="Title" />
        </label>
        <label className="jx-field">
          <span>Organization, lab, program or office</span>
          <input className="input" value={o.org} onChange={(e) => set({ org: e.target.value })} aria-label="Organization" />
        </label>
        <div className="jx-inline">
          <label className="jx-field">
            <span>Deadline</span>
            <input className="input" type="date" value={o.deadline} onChange={(e) => set({ deadline: e.target.value })} aria-label="Deadline" />
          </label>
          <label className="jx-field">
            <span>Hours a week</span>
            <input className="input" inputMode="numeric" value={String(o.hoursPerWeek || '')} onChange={(e) => set({ hoursPerWeek: Math.max(0, Math.min(168, Number(e.target.value) || 0)) })} aria-label="Hours a week" />
          </label>
        </div>
        <label className="jx-field">
          <span>Where you found it</span>
          <input className="input" value={o.source} onChange={(e) => set({ source: e.target.value })} placeholder="The official listing’s address" aria-label="Where you found it" />
        </label>
        {o.kind === 'funding' && !o.source.trim() ? <p className="jx-warn">No source yet — treat this as unverified until you find the official listing.</p> : null}
        <div className="jx-chips" role="radiogroup" aria-label="Stage">
          {STAGES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={o.stage === s} className={`jx-chip${o.stage === s ? ' jx-chip-on' : ''}`} onClick={() => set({ stage: s as OpportunityStage })}>
              {s}
            </button>
          ))}
        </div>
        {o.kind === 'job' ? (
          <label className="jx-check">
            <input type="checkbox" checked={o.workStudy} onChange={() => set({ workStudy: !o.workStudy })} aria-label="This is a work-study position" />
            <span className="jx-check-body">
              <span className="jx-check-title">Work-study position</span>
              <span className="jx-check-detail">Private to you. Never shown in the list or on your resume.</span>
            </span>
          </label>
        ) : null}
      </Card>

      <SectionLabel>Steps</SectionLabel>
      {o.kind === 'abroad' ? <p className="jx-notice">{ABROAD_NOTICE}</p> : null}
      {o.kind === 'research' ? <p className="jx-notice">{IRB_NOTICE}</p> : null}
      <Checklist
        label={`${kind.label} steps`}
        oneAtATime={chunk}
        items={TEMPLATES[o.kind].map((t) => ({ id: t.id, title: t.title, detail: t.office ? <OfficeDoor office={t.office} compact /> : undefined }))}
        done={(id) => Boolean(o.steps[id])}
        onToggle={(id) => set({ steps: { ...o.steps, [id]: !o.steps[id] } })}
      />

      <SectionLabel>What you did</SectionLabel>
      <p className="jx-muted">Write it in your own words. Tick “ready” and it can appear on your resume page — nothing else does.</p>
      {o.evidence.map((e) => (
        <label key={e.id} className="jx-check">
          <input type="checkbox" checked={e.approved} onChange={() => set({ evidence: o.evidence.map((x) => (x.id === e.id ? { ...x, approved: !x.approved } : x)) })} aria-label={`Ready to use: ${e.text}`} />
          <span className="jx-check-body">
            <span className="jx-check-title">{e.text}</span>
            <span className="jx-check-detail">{e.approved ? 'Ready to use' : 'Draft'}</span>
          </span>
        </label>
      ))}
      <div className="jx-inline">
        <input className="input" value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Built a data pipeline for the lab’s survey" aria-label="Something you did" />
        <button type="button" className="btn btn-secondary" onClick={() => { if (ev.trim()) { set({ evidence: [...o.evidence, newEvidence(ev.trim())] }); setEv(''); } }}>
          Add
        </button>
      </div>

      <SectionLabel>Skills it shows</SectionLabel>
      <div className="jx-chips">
        {o.skills.map((s) => (
          <button key={s} type="button" className="jx-chip jx-chip-on" aria-label={`Remove skill ${s}`} onClick={() => set({ skills: o.skills.filter((x) => x !== s) })}>
            {s} ×
          </button>
        ))}
      </div>
      <div className="jx-inline">
        <input className="input" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Python, grant writing, field interviews" aria-label="Add a skill" />
        <button type="button" className="btn btn-secondary" onClick={() => { if (skill.trim() && !o.skills.includes(skill.trim())) { set({ skills: [...o.skills, skill.trim()] }); setSkill(''); } }}>
          Add
        </button>
      </div>

      {o.kind === 'funding' || o.kind === 'research' || o.kind === 'abroad' ? (
        <>
          <SectionLabel>References</SectionLabel>
          {o.references.map((r) => (
            <label key={r.id} className="jx-check">
              <input type="checkbox" checked={r.received} onChange={() => set({ references: o.references.map((x) => (x.id === r.id ? { ...x, received: !x.received } : x)) })} aria-label={`Letter received from ${r.name}`} />
              <span className="jx-check-body">
                <span className="jx-check-title">{r.name}</span>
                <span className="jx-check-detail">{r.received ? 'Letter received' : 'Waiting'}</span>
              </span>
            </label>
          ))}
          <div className="jx-inline">
            <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Who you asked" aria-label="Reference name" />
            <button type="button" className="btn btn-secondary" onClick={() => { if (ref.trim()) { set({ references: [...o.references, { ...newReference(ref.trim()), asked: dateToIso(new Date()) }] }); setRef(''); } }}>
              Add
            </button>
          </div>
          <GoTo screen="people">People and letters</GoTo>
        </>
      ) : null}

      <label className="jx-field">
        <span>Notes</span>
        <textarea className="input jx-area" value={o.notes} onChange={(e) => set({ notes: e.target.value })} aria-label="Notes" />
      </label>
      <button type="button" className="btn btn-ghost btn-block" onClick={() => setDeleting(true)}>
        Delete this
      </button>
      {deleting ? (
        <ConfirmDialog
          title="Delete this opportunity?"
          preview={
            <ActionPreview
              subject={o.title || `${kind.label} opportunity`}
              says="Deletes this opportunity tracker entry from this device."
              exactly={`Its organization, stage, deadline, source link, checklist, private work-study flag, evidence, reference tracking, skills, hours estimate and notes will be removed.${o.notes.trim() ? ` Notes include: ${o.notes.trim()}` : ''}`}
              doesNotChange="Other tracked opportunities, your weekly time budget, official listings and anything held by an employer, lab, program or campus office stay unchanged."
              recovery={{ kind: 'none', how: 'There is no undo or backup for this tracker. Add the opportunity again from its original source if you need it later.' }}
            />
          }
          confirmLabel="Delete opportunity"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false);
            onDelete();
          }}
        />
      ) : null}
    </>
  );
}

const BUDGET_LABELS: Record<keyof TimeBudget, string> = {
  classes: 'Classes',
  study: 'Study',
  work: 'Work',
  commute: 'Commuting',
  caregiving: 'Caregiving',
  sleep: 'Sleep',
  other: 'Everything else you commit to',
};

function Time({ budget, items, onChange }: { budget: TimeBudget; items: readonly Opportunity[]; onChange: (b: TimeBudget) => void }) {
  const t = timeBudget(budget);
  const tracked = items.filter((o) => o.stage === 'Active').reduce((a, o) => a + o.hoursPerWeek, 0);
  return (
    <>
      <Card kicker="Your week, in hours" title={t.fits ? `${t.left} hours left of 168` : `${-t.left} hours more than a week has`}>
        <p className="jx-muted">Your own estimates. {tracked ? `Your active opportunities add up to ${tracked} hours a week.` : ''} Shifts go in your plan only if you add them there.</p>
      </Card>
      {(Object.keys(BUDGET_LABELS) as (keyof TimeBudget)[]).map((k) => (
        <label key={k} className="jx-field jx-field-row">
          <span>{BUDGET_LABELS[k]}</span>
          <input className="input" inputMode="numeric" value={String(budget[k])} onChange={(e) => onChange({ ...budget, [k]: Math.max(0, Math.min(168, Number(e.target.value) || 0)) })} aria-label={`${BUDGET_LABELS[k]}, hours a week`} />
        </label>
      ))}
      <GoTo screen="calendar">Add shifts to your calendar</GoTo>
    </>
  );
}

function Resume({ items }: { items: readonly Opportunity[] }) {
  const groups = resumeBullets(items);
  const skills = skillMap(items);
  return (
    <>
      <p className="jx-muted">Built only from what you marked ready. Copy what you want into your resume.</p>
      {groups.map((g) => (
        <Card key={g.heading} title={g.heading}>
          <ul>
            {g.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Card>
      ))}
      {!groups.length ? <p className="jx-muted">Nothing marked ready yet. Open an opportunity and tick what you did.</p> : null}
      {skills.length ? (
        <>
          <SectionLabel>Skills, and where they come from</SectionLabel>
          {skills.map((s) => (
            <div key={s.skill} className="jx-row">
              <span>{s.skill}</span>
              <span className="jx-muted">{s.from.join(', ')}</span>
            </div>
          ))}
        </>
      ) : null}
      <GoTo screen="career">Open Career</GoTo>
    </>
  );
}
