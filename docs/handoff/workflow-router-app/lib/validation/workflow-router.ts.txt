import { z } from 'zod';
export const RouterAnswersSchema = z.object({
  deliverable: z.enum(['interactive-tool', 'prototype', 'marketing-page', 'diagram', 'document', 'presentation', 'data-analysis', 'react-component', 'full-stack']),
  interaction: z.enum(['none', 'simple-local', 'complex-local', 'multi-user']),
  backend: z.enum(['none', 'file-export', 'database', 'server-api', 'auth-secrets']),
  technology: z.enum(['none', 'html', 'react', 'nextjs', 'nextjs-postgres', 'nextjs-supabase']),
  persistence: z.enum(['none', 'database', 'auth', 'storage', 'realtime', 'multi-tenant']),
  handoff: z.enum(['share', 'document-export', 'github', 'vercel']),
});
export type RouterAnswers = z.infer<typeof RouterAnswersSchema>;
export const SaveRecommendationSchema = z.object({ title: z.string().trim().min(1).max(160), organizationId: z.string().uuid().nullable(), answers: RouterAnswersSchema, visibility: z.enum(['private', 'organization']).default('private') });
