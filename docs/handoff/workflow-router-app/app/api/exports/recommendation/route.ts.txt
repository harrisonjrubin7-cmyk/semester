import { NextResponse } from 'next/server';
import { RouterAnswersSchema } from '@/lib/validation/workflow-router';
import { recommend } from '@/lib/workflow-router/engine';
import { buildPrompt } from '@/lib/workflow-router/prompts';
import { recommendationMarkdown } from '@/lib/exports/markdown';
import { toJson } from '@/lib/exports/json';
export async function POST(req: Request) {
  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'md';
  const parsed = RouterAnswersSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const r = recommend(parsed.data); const prompt = buildPrompt(parsed.data, r);
  const body = format === 'json' ? toJson({ answers: parsed.data, recommendation: r, prompt }) : recommendationMarkdown(parsed.data, r, prompt);
  return new NextResponse(body, { headers: { 'content-type': format === 'json' ? 'application/json' : 'text/markdown; charset=utf-8', 'content-disposition': 'attachment; filename="semester-recommendation.' + format + '"' } });
}
