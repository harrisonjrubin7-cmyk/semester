import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { decide, slugify } from '../lib/pubRules';

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? '';
const fail = (m: string): never => { const e = new ZiteError(m); e.userFacingMessage = m; throw e; };

const Pub = z.object({
  id: z.string(), title: z.string(), slug: z.string(), summary: z.string(), body: z.string(), status: z.string(),
  claimTypes: z.array(z.string()), claimSources: z.string(), authorId: z.string(), reviewerId: z.string(),
  reviewNote: z.string(), history: z.string(), publishedAt: z.string().nullable(), mine: z.boolean(),
});

// Draft → review → approval → publication. No email, newsletter or social sending exists in this flow.
export default createEndpoint({
  description: 'Lists and moves public-site posts through draft, review, approval and publication',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'submit', 'approve', 'requestChanges', 'publish', 'withdraw']),
    id: z.string().optional(),
    title: z.string().optional(), slug: z.string().optional(), summary: z.string().optional(), body: z.string().optional(),
    claimTypes: z.array(z.string()).optional(), claimSources: z.string().optional(), note: z.string().optional(),
  }),
  outputSchema: z.object({ items: z.array(Pub) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const who = `${context.user.firstName ?? ''} ${context.user.lastName ?? ''}`.trim() || context.user.email;
    const stamp = (s: string, h?: string) => `${new Date().toISOString()} · ${who} · ${s}\n${h ?? ''}`;

    if (input.action !== 'list') {
      const cur = input.id ? await zite.sitePublications.findOne({ id: input.id }) : undefined;
      if (input.id && !cur) fail('That post no longer exists.');
      const status = cur?.status ?? 'Draft';
      const author = first(cur?.author);
      const set = (record: Record<string, unknown>, what: string) =>
        zite.sitePublications.update({ id: cur!.id, record: { ...record, history: stamp(what, cur!.history) } });

      const state = { status, authorId: author, body: cur?.body ?? '', claimTypes: cur?.claimTypes ?? [], claimSources: cur?.claimSources ?? '', slug: cur?.slug ?? '' };
      if (input.action === 'save') {
        const d = decide('save', state, me); if (!d.ok) fail(d.reason);
        const title = (input.title ?? '').trim();
        if (title.length < 3) fail('Give the post a title.');
        const slug = slugify(input.slug || title);
        const record = { title, slug, summary: input.summary ?? '', body: input.body ?? '', claimTypes: input.claimTypes ?? [], claimSources: input.claimSources ?? '' };
        if (cur) await set(record, 'Edited draft');
        else await zite.sitePublications.create({ record: { ...record, status: 'Draft', author: me, history: stamp('Created draft') } });
      } else {
        if (!cur) fail('Choose a post first.');
        const c = cur!;
        const note = (input.note ?? '').trim();
        let slugTakenByOther = false;
        if (input.action === 'publish') {
          const { records } = await zite.sitePublications.findAll({ filters: { slug: c.slug ?? '', status: 'Published' }, limit: 5 });
          slugTakenByOther = records.some((r) => r.id !== c.id);
        }
        const d = decide(input.action, state, me, { note, slugTakenByOther });
        if (!d.ok) return fail(d.reason);
        if (input.action === 'submit') await set({ status: d.next }, 'Submitted for review');
        else if (input.action === 'approve' || input.action === 'requestChanges')
          await set({ status: d.next, reviewer: me, reviewNote: note }, input.action === 'approve' ? `Approved${note ? `: ${note}` : ''}` : `Requested changes: ${note}`);
        else if (input.action === 'publish') await set({ status: d.next, publishedAt: new Date().toISOString() }, 'Published to the public site (no notifications sent)');
        else await set({ status: d.next }, `Withdrawn${note ? `: ${note}` : ''}`);
      }
    }

    const { records } = await zite.sitePublications.findAll({ limit: 500 });
    return {
      items: records.map((r) => ({
        id: r.id, title: r.title ?? '', slug: r.slug ?? '', summary: r.summary ?? '', body: r.body ?? '', status: r.status ?? 'Draft',
        claimTypes: r.claimTypes ?? [], claimSources: r.claimSources ?? '', authorId: first(r.author), reviewerId: first(r.reviewer),
        reviewNote: r.reviewNote ?? '', history: r.history ?? '', publishedAt: r.publishedAt ?? null, mine: first(r.author) === me,
      })),
    };
  },
});
