import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Public read: only posts that passed review and were published. Drafts never leave Company OS.
export default createEndpoint({
  description: 'Lists published updates for the public site',
  inputSchema: z.object({ slug: z.string().optional() }),
  outputSchema: z.object({
    posts: z.array(z.object({ slug: z.string(), title: z.string(), summary: z.string(), body: z.string(), publishedAt: z.string() })),
  }),
  execute: async ({ input }) => {
    const { records } = await zite.sitePublications.findAll({
      filters: input.slug ? { status: 'Published', slug: input.slug } : { status: 'Published' },
      limit: 200,
    });
    return {
      posts: records
        .map((r) => ({ slug: r.slug ?? '', title: r.title ?? '', summary: r.summary ?? '', body: r.body ?? '', publishedAt: r.publishedAt ?? '' }))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    };
  },
});
