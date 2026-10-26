import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { GRP_MIGRATION } from '../lib/grpMigration';
import { courseRole } from '../lib/teamServer';

let ready: Promise<void> | null = null;
const ensureGrp = () => { if (!ready) ready = (async () => { for (const q of GRP_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
type Row = Record<string, unknown>;
const fail = (e: string | null | undefined) => { if (e) forbid(e); };

// Course groups (MOD-034). Instructors create sets and groups and assign enrolled students; in self-signup sets,
// students join or leave themselves. Students see only their own group's members; delegates and instructors see all.
export default createEndpoint({
  description: 'Course groups: group sets, groups, assignment by the instructor or self-signup within a size cap',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), sectionId: z.string() }),
    z.object({ action: z.literal('createSet'), sectionId: z.string(), name: z.string().max(120), selfSignup: z.boolean(), maxSize: z.number().int().min(2).max(50), groups: z.number().int().min(1).max(50) }),
    z.object({ action: z.literal('assign'), sectionId: z.string(), groupId: z.number().int(), studentId: z.string() }),
    z.object({ action: z.literal('remove'), sectionId: z.string(), setId: z.number().int(), studentId: z.string() }),
    z.object({ action: z.literal('join'), sectionId: z.string(), groupId: z.number().int() }),
    z.object({ action: z.literal('leave'), sectionId: z.string(), setId: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensureGrp();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    if (!(await tenantScope(T)).sections.has(input.sectionId)) forbid('That section is not in your institution.');
    const role = await courseRole(T, input.sectionId, me);
    const enr = (await zite.enrollments.findAll({ filters: { section: input.sectionId }, limit: 1000 })).records.filter((e) => e.status === 'Enrolled');
    const students = [...new Set(enr.map((e) => first(e.student) ?? '').filter(Boolean))];
    const enrolled = students.includes(me);
    if (!role && !enrolled) forbid('You are not enrolled in or teaching this section.');
    const instructorOnly = () => { if (role !== 'instructor') forbid('Only an instructor of record can manage groups.'); };
    const ownSet = async (setId: number) => { if (!((await sql.query(`SELECT 1 FROM grp_sets WHERE id = $1 AND tenant_id = $2 AND section_id = $3`, [setId, T, input.sectionId])) as Row[]).length) forbid('Group set not found in this section.'); };
    const ownGroup = async (groupId: number) => { if (!((await sql.query(`SELECT 1 FROM grp_groups g JOIN grp_sets s ON s.id = g.set_id WHERE g.id = $1 AND s.tenant_id = $2 AND s.section_id = $3`, [groupId, T, input.sectionId])) as Row[]).length) forbid('Group not found in this section.'); };

    if (input.action === 'createSet') {
      instructorOnly();
      if (input.name.trim().length < 2) forbid('Name the group set.');
      const id = ((await sql.query(`INSERT INTO grp_sets (tenant_id, section_id, name, self_signup, max_size, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [T, input.sectionId, input.name.trim(), input.selfSignup, input.maxSize, me])) as Row[])[0].id;
      for (let i = 1; i <= input.groups; i++) await sql.query(`INSERT INTO grp_groups (set_id, name) VALUES ($1,$2)`, [id, `Group ${i}`]);
      await audit(a, 'Group set created', `section:${input.sectionId}`, `${input.name} · ${input.groups} groups`, 'Instructor of record');
    }
    if (input.action === 'assign') {
      instructorOnly(); await ownGroup(input.groupId);
      if (!students.includes(input.studentId)) forbid('Only students enrolled in this section can be placed in a group.');
      fail(((await sql.query(`SELECT grp_join($1,$2,$3,$4,true) AS e`, [T, input.groupId, input.studentId, me])) as { e: string | null }[])[0].e);
    }
    if (input.action === 'remove') {
      instructorOnly(); await ownSet(input.setId);
      fail(((await sql.query(`SELECT grp_leave($1,$2,$3,$4,true) AS e`, [T, input.setId, input.studentId, me])) as { e: string | null }[])[0].e);
    }
    if (input.action === 'join') {
      if (!enrolled) forbid('Only enrolled students join groups.');
      await ownGroup(input.groupId);
      fail(((await sql.query(`SELECT grp_join($1,$2,$3,$3,false) AS e`, [T, input.groupId, me])) as { e: string | null }[])[0].e);
    }
    if (input.action === 'leave') {
      if (!enrolled) forbid('Only enrolled students leave groups.');
      await ownSet(input.setId);
      fail(((await sql.query(`SELECT grp_leave($1,$2,$3,$3,false) AS e`, [T, input.setId, me])) as { e: string | null }[])[0].e);
    }

    const sets = (await sql.query(`SELECT * FROM grp_sets WHERE tenant_id = $1 AND section_id = $2 ORDER BY id`, [T, input.sectionId])) as Row[];
    const groups = (await sql.query(`SELECT * FROM grp_groups WHERE set_id = ANY($1) ORDER BY id`, [sets.map((s) => Number(s.id))])) as Row[];
    const members = (await sql.query(`SELECT * FROM grp_members WHERE set_id = ANY($1)`, [sets.map((s) => Number(s.id))])) as Row[];
    const seesAll = !!role;
    const myGroups = new Set(members.filter((m) => m.student_id === me).map((m) => Number(m.group_id)));
    const names = await userNames(seesAll ? [...students, ...members.map((m) => String(m.student_id))] : members.filter((m) => myGroups.has(Number(m.group_id))).map((m) => String(m.student_id)));
    return {
      role: role ?? 'student',
      students: role === 'instructor' ? students.map((id) => ({ id, name: names[id] ?? 'Student' })) : [],
      sets: sets.map((s) => ({ id: Number(s.id), name: String(s.name), selfSignup: !!s.self_signup, maxSize: Number(s.max_size),
        groups: groups.filter((g) => Number(g.set_id) === Number(s.id)).map((g) => {
          const ms = members.filter((m) => Number(m.group_id) === Number(g.id));
          const visible = seesAll || myGroups.has(Number(g.id));
          return { id: Number(g.id), name: String(g.name), size: ms.length, mine: myGroups.has(Number(g.id)),
            members: visible ? ms.map((m) => ({ id: String(m.student_id), name: names[String(m.student_id)] ?? 'Student' })) : [] };
        }) })),
    };
  },
});
