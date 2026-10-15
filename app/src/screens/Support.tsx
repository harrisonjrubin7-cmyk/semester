import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { SectionLabel, TabList } from '../components/ui';
import { Card, Checklist, GoTo, Never, OfficeDoor } from '../components/JourneyKit';
import { RoomsNow } from '../components/RoomsNow';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActionPreview } from '../components/unity/ActionPreview';
import { useDeviceLibrary } from '../lib/device-library';
import { hasMode } from '../lib/accessmode';
import { clock } from '../lib/date';
import {
  CONTINUITY,
  EMPTY_SUPPORT,
  PREPAREDNESS,
  PRIVACY_SAYS,
  ROUTINE_IDEAS,
  SECTIONS,
  arranged,
  leaveBy,
  readSupport,
  type Entry,
  type Section,
  type SupportLibrary,
} from '../lib/support';

/**
 * The map of every office that is not a course.
 *
 * See `lib/support.ts` for the rules. The one the screen carries is order: the
 * privacy line is drawn *before* the door on every entry, because a student
 * deciding whether to walk in needs it before, not after.
 */

type Tab = Section['id'];

export function Support() {
  const { account } = useStore();
  return <Workspace key={account?.id || 'device'} storageKey={`semester.support.v1:${account?.id || 'device'}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { state } = useStore();
  const lib = useDeviceLibrary(storageKey, readSupport, EMPTY_SUPPORT);
  const [tab, setTab] = useState<Tab>('now');
  const section = SECTIONS.find((s) => s.id === tab)!;
  const sensory = hasMode(state.access, 'sensory');
  const chunk = hasMode(state.access, 'chunk');
  const set = (patch: Partial<SupportLibrary>) => lib.update((old) => ({ ...old, ...patch }));

  return (
    <Page blurb="Where to go for care, basic needs, access, safety and the campus itself — and what happens to what you say there.">
      <TabList label="Support" className="portal-tabs" value={tab} onChange={setTab} tabs={SECTIONS.map((s) => ({ id: s.id, label: s.label }))} />
      <p className="jx-lead">{section.intro}</p>
      <p className="jx-muted">
        Not sure which door fits? <GoTo screen="help">See who can help with what</GoTo>
      </p>
      {lib.error ? <p className="jx-warn" role="alert">{lib.error}</p> : null}

      {section.groups.map((g) => (
        <div key={g.heading}>
          <SectionLabel>{g.heading}</SectionLabel>
          {arranged(g.entries, sensory).map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </div>
      ))}

      {tab === 'now' ? <Now lib={lib.value} set={set} chunk={chunk} /> : null}
      {tab === 'care' ? <Routines lib={lib.value} set={set} /> : null}
      {tab === 'access' ? <AccessNotes lib={lib.value} set={set} /> : null}
      {tab === 'campus' ? <RoomsNow sensory={sensory} /> : null}
      {tab === 'campus' ? <Commute lib={lib.value} set={set} /> : null}

      <Never items={section.never} />
    </Page>
  );
}

function EntryCard({ entry: e }: { entry: Entry }) {
  return (
    <div className="jx-entry">
      <div className="jx-entry-head">
        <span className="jx-entry-title">{e.title}</span>
        <span className={`jx-tag${e.studentRun ? ' jx-tag-student' : ''}`}>{e.studentRun ? 'Student-run' : e.office || e.call ? 'Official' : 'In this app'}</span>
        {e.quiet ? <span className="jx-tag">Quiet</span> : null}
      </div>
      <div className="jx-entry-what">{e.what}</div>
      <div className="jx-privacy">{PRIVACY_SAYS[e.privacy]}</div>
      {e.call ? (
        <a className="jx-call" href={`tel:${e.call}`}>
          Call {e.call}
        </a>
      ) : null}
      {e.office ? <OfficeDoor office={e.office} compact /> : null}
      {e.screen ? <GoTo screen={e.screen}>Open in Semester</GoTo> : null}
    </div>
  );
}

function Now({ lib, set, chunk }: { lib: SupportLibrary; set: (p: Partial<SupportLibrary>) => boolean; chunk: boolean }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [removing, setRemoving] = useState<SupportLibrary['contacts'][number] | null>(null);
  const [notice, setNotice] = useState('');
  const add = () => {
    if (!name.trim() || !phone.trim()) return;
    set({ contacts: [...lib.contacts, { id: `c-${Date.now().toString(36)}`, name: name.trim(), phone: phone.trim() }].slice(0, 10) });
    setName('');
    setPhone('');
  };
  return (
    <>
      <SectionLabel>Your own emergency contacts</SectionLabel>
      <p className="jx-muted">Kept on this device only.</p>
      {lib.contacts.map((c) => (
        <div key={c.id} className="jx-row">
          <a href={`tel:${c.phone}`}>{c.name} · {c.phone}</a>
          <button type="button" className="bare" aria-label={`Remove ${c.name}`} onClick={() => setRemoving(c)}>
            ×
          </button>
        </div>
      ))}
      {removing ? (
        <ConfirmDialog
          title="Remove this emergency contact?"
          preview={(
            <ActionPreview
              subject={removing.name}
              says="Removes this name and phone number from the Support workspace on this device."
              exactly={removing.phone}
              doesNotChange="Other emergency contacts, access planning notes, routines, continuity choices and official campus records stay unchanged."
              recovery={{ kind: 'none', how: 'This Support workspace is not included in a device workspace backup. You can add the contact again if you still know the details.' }}
            />
          )}
          confirmLabel="Remove contact"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            if (set({ contacts: lib.contacts.filter((contact) => contact.id !== removing.id) })) {
              setNotice(`${removing.name} removed from this device.`);
              setRemoving(null);
            }
          }}
        />
      ) : null}
      {notice ? <p className="jx-muted" role="status">{notice}</p> : null}
      <div className="jx-inline">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Contact name" />
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" inputMode="tel" aria-label="Contact phone" />
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add
        </button>
      </div>

      <SectionLabel>Keep the term going if campus closes</SectionLabel>
      <Checklist
        label="Continuity checklist"
        oneAtATime={chunk}
        items={CONTINUITY.map((c) => ({ id: c.id, title: c.title, detail: c.screen ? <GoTo screen={c.screen}>Open</GoTo> : undefined }))}
        done={(id) => Boolean(lib.continuity[id])}
        onToggle={(id) => set({ continuity: { ...lib.continuity, [id]: !lib.continuity[id] } })}
      />

      <SectionLabel>What to do during…</SectionLabel>
      {PREPAREDNESS.map((p) => (
        <Card key={p.id} title={p.during}>
          <ol className="jx-ol">
            {p.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>
      ))}
      <p className="jx-muted">These are the shape of a plan. Your school’s official emergency guide and alerts decide what to do.</p>
    </>
  );
}

function Routines({ lib, set }: { lib: SupportLibrary; set: (p: Partial<SupportLibrary>) => void }) {
  const flip = (r: string) => set({ routines: lib.routines.includes(r) ? lib.routines.filter((x) => x !== r) : [...lib.routines, r] });
  return (
    <>
      <SectionLabel>Routines you want to keep in view</SectionLabel>
      <p className="jx-muted">Chosen by you, kept on this device, and never measured.</p>
      <div className="jx-chips" role="group" aria-label="Routines">
        {ROUTINE_IDEAS.map((r) => (
          <button key={r} type="button" aria-pressed={lib.routines.includes(r)} className={`jx-chip${lib.routines.includes(r) ? ' jx-chip-on' : ''}`} onClick={() => flip(r)}>
            {r}
          </button>
        ))}
      </div>
    </>
  );
}

function AccessNotes({ lib, set }: { lib: SupportLibrary; set: (p: Partial<SupportLibrary>) => void }) {
  return (
    <>
      <SectionLabel>Your planning notes</SectionLabel>
      <label className="jx-field">
        <span>Questions for the access office, what works for you, what to ask each instructor. Private to this device and never an official record.</span>
        <textarea className="input jx-area" value={lib.accessNotes} onChange={(e) => set({ accessNotes: e.target.value })} aria-label="Access planning notes" />
      </label>
      <GoTo screen="setLook">Reading, focus and plain-language settings</GoTo>
    </>
  );
}

function Commute({ lib, set }: { lib: SupportLibrary; set: (p: Partial<SupportLibrary>) => void }) {
  const [start, setStart] = useState('09:00');
  const [bad, setBad] = useState(false);
  const [h, m] = start.split(':').map(Number);
  const at = Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 540;
  const leave = leaveBy(at, lib.commute.travel, lib.commute.buffer, bad);
  const num = (v: string) => Math.max(0, Math.min(600, Number(v) || 0));
  return (
    <Card kicker="Commuting" title={`Leave by ${clock(leave)}`}>
      <div className="jx-inline">
        <label className="jx-field">
          <span>Class starts</span>
          <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Class start time" />
        </label>
        <label className="jx-field">
          <span>Travel, minutes</span>
          <input className="input" inputMode="numeric" value={String(lib.commute.travel)} onChange={(e) => set({ commute: { ...lib.commute, travel: num(e.target.value) } })} aria-label="Travel minutes" />
        </label>
        <label className="jx-field">
          <span>Buffer, minutes</span>
          <input className="input" inputMode="numeric" value={String(lib.commute.buffer)} onChange={(e) => set({ commute: { ...lib.commute, buffer: num(e.target.value) } })} aria-label="Buffer minutes" />
        </label>
      </div>
      <label className="jx-check">
        <input type="checkbox" checked={bad} onChange={() => setBad(!bad)} aria-label="Bad weather day" />
        <span className="jx-check-body">
          <span className="jx-check-title">Bad weather day</span>
          <span className="jx-check-detail">Doubles the buffer. A rule of thumb — check official transit notices.</span>
        </span>
      </label>
    </Card>
  );
}
