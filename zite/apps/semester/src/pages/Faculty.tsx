import { Link } from 'react-router-dom';
import { officeHours } from 'zitejs/api';
import { PageHeader, Panel, Empty, Loadable, useLoad, fmt } from '../components/kit';
import { HostOfficeHours, StudentAppointments } from '../components/OfficeHours';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Semester Faculty: the teaching workspace home (S-55 §6/§11). Pulls teaching sections, today's office hours and the
// teaching queues together; each linked page enforces its own permissions.
const TOOLS = [
  { to: '/staff/queue', title: 'Grading queue', note: 'Submitted work waiting for feedback (yours and delegated)' },
  { to: '/staff/gradebook', title: 'Gradebook', note: 'Course grades; release follows the authorized grade workflow' },
  { to: '/staff/regrades', title: 'Regrade requests', note: 'Student requests to review a released grade' },
  { to: '/you/integrity', title: 'Academic integrity', note: 'Report a concern, offer a course-level resolution, follow a referral' },
  { to: '/institution/sections', title: 'New sections', note: 'Request a section or see teaching assignments' },
  { to: '/institution/curriculum', title: 'Curriculum', note: 'Propose a course or new version; chairs and the committee review it here' },
];

export default function Faculty() {
  const s = useLoad(() => officeHours({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Faculty" title="Teaching" sub="Your sections, office hours and grading in one place. Course grades stay separate from official records until the registrar posts them." />
      <Loadable state={s}>{(d: any) => {
        const today = new Date(d.now).toISOString().slice(0, 10);
        const todays = d.hosting.filter((x: any) => !x.cancelled && x.start.slice(0, 10) === today);
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Panel title={`Sections you teach · ${d.teaching.length}`}>
                {d.teaching.length ? <ul className="space-y-1 text-sm">{d.teaching.map((t: any) => <li key={t.id}><Link className="underline" to={`/learn/${t.id}`}>{t.label}</Link></li>)}</ul>
                  : <Empty>No sections yet. A registrar assigns you when a section is created.</Empty>}
              </Panel>
              <Panel title={`Office hours today · ${todays.length}`}>
                {todays.length ? <ul className="space-y-1 text-sm">{todays.map((x: any) => <li key={x.id}>{fmt(x.start)} · {x.section ?? x.kind} · {x.bookings.length}/{x.capacity} booked</li>)}</ul> : <Empty>None today.</Empty>}
              </Panel>
              <Panel title="Teaching tools">
                <ul className="space-y-2 text-sm">{TOOLS.map((t) => <li key={t.to}><Link className="font-medium underline" to={t.to}>{t.title}</Link><span className="block text-xs text-muted-foreground">{t.note}</span></li>)}</ul>
              </Panel>
            </div>
            <HostOfficeHours d={d} reload={s.reload} />
          </div>
        );
      }}</Loadable>
    </>
  );
}

export function Appointments() {
  const s = useLoad(() => officeHours({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Help" title="Office hours & appointments" sub="Book time with your instructors, advisors and tutors. Cancel any time before it starts." />
      <Loadable state={s}>{(d: any) => <div className="space-y-4"><StudentAppointments d={d} reload={s.reload} />{d.hostKinds.length > 0 && !d.hostKinds.includes('Office hours') && <HostOfficeHours d={d} reload={s.reload} />}</div>}</Loadable>
    </>
  );
}
