import { zite } from 'zitejs/db';
import { ids, first, Tenant } from './server';

export type Hit = { id: string; kind: string; title: string; detail: string; source: string; path: string };

/** Permission-aware retrieval: only records the caller may already see, inside the caller's institution.
 *  `catalogSource` is the provenance label for institution catalog records ('Sample' for a sample tenant, else 'Official'). */
export async function scopedSearch(uid: string, q: string, tenant: Tenant, catalogSource: 'Sample' | 'Official'): Promise<Hit[]> {
  const needle = q.toLowerCase().trim();
  const match = (...s: (string | undefined)[]) => !needle || s.some((x) => (x ?? '').toLowerCase().includes(needle));
  const [tasks, enr, secs, courses, res, groups, events, reqs] = await Promise.all([
    zite.tasks.findAll({ filters: { owner: uid }, limit: 500 }),
    zite.enrollments.findAll({ filters: { student: uid }, limit: 500 }),
    zite.sections.findAll({ limit: 1000 }),
    zite.courses.findAll({ limit: 1000 }),
    zite.resources.findAll({ filters: { owner: uid }, limit: 500 }),
    zite.groups.findAll({ limit: 200 }),
    zite.events.findAll({ limit: 200 }),
    zite.requirements.findAll({ limit: 200 }),
  ]);
  courses.records = courses.records.filter((c) => tenant.courses.has(c.id));
  reqs.records = reqs.records.filter((r) => tenant.requirements.has(r.id));
  groups.records = groups.records.filter((g) => tenant.groups.has(g.id) && g.kind !== 'Course Discussion');
  const okGroups = new Set(groups.records.map((g) => g.id));
  events.records = events.records.filter((e) => ids(e.group).some((g) => okGroups.has(g)));
  const cById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
  const hits: Hit[] = [];
  tasks.records.filter((t) => match(t.title, t.rubric)).forEach((t) => hits.push({ id: t.id, kind: t.type ?? 'Task', title: t.title ?? '', detail: t.dueAt ? `Due ${t.dueAt}` : t.status ?? '', source: t.source ?? 'Yours', path: t.type === 'Hold' ? '/help' : '/today' }));
  const mySecs = new Set(enr.records.map((e) => first(e.section)));
  secs.records.filter((s) => tenant.sections.has(s.id) && (mySecs.has(s.id) || ids(s.instructors).includes(uid))).forEach((s) => {
    const c = cById[first(s.course) ?? ''];
    if (match(c?.code, c?.title, s.syllabus)) hits.push({ id: s.id, kind: 'Course', title: `${c?.code} · ${c?.title}`, detail: `${s.term} · ${s.meetingTimes} · AI policy: ${s.courseAiPolicy}`, source: catalogSource, path: `/learn/${s.id}` });
  });
  // Public catalog is visible to every member
  courses.records.filter((c) => needle && match(c.code, c.title)).forEach((c) => hits.push({ id: c.id, kind: 'Catalog', title: `${c.code} · ${c.title}`, detail: `${c.credits} credits`, source: catalogSource, path: '/plan/registration' }));
  reqs.records.filter((r) => match(r.name, r.program)).forEach((r) => hits.push({ id: r.id, kind: 'Requirement', title: r.name ?? '', detail: `${r.creditsRequired} credits · ${r.program}`, source: catalogSource, path: '/progress' }));
  res.records.filter((r) => match(r.title, r.body)).forEach((r) => hits.push({ id: r.id, kind: r.kind ?? 'Note', title: r.title ?? '', detail: `Visibility: ${r.visibility}`, source: r.source ?? 'Yours', path: '/learn/study' }));
  groups.records.filter((g) => needle && match(g.name)).forEach((g) => hits.push({ id: g.id, kind: g.kind ?? 'Group', title: g.name ?? '', detail: `${ids(g.members).length} members`, source: catalogSource, path: '/campus' }));
  events.records.filter((e) => needle && match(e.title, e.location)).forEach((e) => hits.push({ id: e.id, kind: 'Event', title: e.title ?? '', detail: `${e.startsAt ?? ''} · ${e.location ?? ''}`, source: catalogSource, path: '/campus' }));
  return hits;
}

