import { z } from 'zod';
import OpenAI from 'openai';
import { createEndpoint } from 'zitejs/backend';
import { integrations } from 'zitejs/integrations';
import { zite } from 'zitejs/db';
import { requireAccess, audit, tenantScope, first } from '../lib/server';
import { scopedSearch, Hit } from '../lib/search';
import { gate, classify, sendableToAI, promptRule, SectionRef, CoursePolicy } from '../lib/aiGate';
import { specialistInstruction, specialistByKey } from '../lib/intelligence';

const STOP = new Set(['what', 'do', 'i', 'my', 'the', 'a', 'an', 'for', 'to', 'is', 'are', 'still', 'need', 'how', 'when', 'of', 'in', 'on', 'and', 'me', 'can', 'should', 'have']);

export default createEndpoint({
  description: 'Ask Semester: checks course AI rules and data classes, gathers scoped sources and writes a cited AI-assisted answer',
  authenticated: true,
  inputSchema: z.object({ question: z.string().min(2).max(500), mode: z.enum(['tutor', 'course_guide']).optional() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const consent = await zite.consents.findOne({ filters: { member: a.userId, consentType: 'Assistant Use' } });
    const allowed = !!consent?.granted && !consent?.revoked;
    const inst = await zite.institutions.findOne({ id: a.institutionId });
    const policy = inst?.aiPolicy ? inst.aiPolicy.split(' — ')[0] : 'No institution AI policy set';
    const scope = ['Your tasks', 'Your courses', 'Your notes', 'Catalog', 'Degree requirements', 'Campus groups and events'];
    const tenant = await tenantScope(a.institutionId);

    // 1. Course / tenant AI policy check (before any record is read).
    const [secs, courses] = await Promise.all([
      zite.sections.findAll({ limit: 2000, fields: ['course', 'courseAiPolicy'] }),
      zite.courses.findAll({ limit: 2000, fields: ['code', 'title'] }),
    ]);
    const cById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
    const sectionRefs: SectionRef[] = secs.records.filter((s) => tenant.sections.has(s.id)).map((s) => {
      const c = cById[first(s.course) ?? ''];
      return { id: s.id, code: c?.code ?? '', title: c?.title ?? '', policy: (s.courseAiPolicy ?? 'Allowed') as CoursePolicy };
    });
    const decision = gate(input.question, sectionRefs);

    // 2. Retrieval inside the caller's scope, then data classification.
    const seen = new Set<string>();
    const sources: (Hit & { dataClass: string; sentToAI: boolean })[] = [];
    const withheld: Record<string, number> = {};
    if (allowed && decision.level !== 'blocked') {
      const terms = input.question.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
      for (const t of terms.length ? terms : ['']) {
        for (const h of await scopedSearch(a.userId, t, tenant, a.isSample ? 'Sample' : 'Official')) {
          if (seen.has(h.id)) continue;
          seen.add(h.id);
          const dataClass = classify(h.kind);
          if (dataClass === 'Restricted') { withheld[dataClass] = (withheld[dataClass] ?? 0) + 1; continue; }
          const sentToAI = sendableToAI(dataClass);
          if (!sentToAI) withheld[dataClass] = (withheld[dataClass] ?? 0) + 1;
          sources.push({ ...h, dataClass, sentToAI });
        }
        if (sources.length >= 8) break;
      }
    }
    // Sources the AI may read come first, so their [n] numbers match the citations; the rest are shown to the student only.
    const top = [...sources.filter((x) => x.sentToAI), ...sources.filter((x) => !x.sentToAI)].slice(0, 8);
    const aiSources = top.filter((x) => x.sentToAI);

    // 3. Answer only from the numbered sources, under the course rule.
    let answer: string | null = null;
    let confidence: 'high' | 'moderate' | 'low' | null = null;
    let limits: string | null = null;
    if (allowed && decision.level !== 'blocked' && aiSources.length) {
      const { accessToken } = await integrations.get('openai');
      const openai = new OpenAI({ apiKey: accessToken });
      const list = aiSources.map((s, i) => `[${i + 1}] ${s.kind}: ${s.title} — ${s.detail} (source: ${s.source})`).join('\n');
      const rule = promptRule(decision);
      // Specialist mode (Semester Intelligence) changes assistance style only: same gate, same sources, same egress.
      const modeRule = input.mode ? specialistInstruction(input.mode) : null;
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You are Ask Semester, an assistive tool for a student. Answer ONLY from the numbered records given. Cite every claim with [n]. If the records don't answer the question, say so plainly. Never claim to have changed, registered, or submitted anything. Be brief (max 4 sentences), sentence case, no emoji. Institution AI policy: ${policy}.${rule ? ' ' + rule : ''}${modeRule ? ' ' + modeRule : ''} Reply as JSON: {"answer": string, "confidence": "high"|"moderate"|"low", "limits": string (one sentence on what these records can't tell)}.` },
          { role: 'user', content: `Records:\n${list}\n\nQuestion: ${input.question}` },
        ],
      });
      try {
        const j = JSON.parse(res.choices[0]?.message?.content ?? '{}');
        answer = typeof j.answer === 'string' ? j.answer : null;
        confidence = ['high', 'moderate', 'low'].includes(j.confidence) ? j.confidence : 'low';
        limits = typeof j.limits === 'string' ? j.limits : null;
      } catch { answer = null; }
    }
    const withheldNote = Object.entries(withheld).map(([k, n]) => `${n} ${k}`).join(', ');
    await audit(a, decision.level === 'blocked' ? 'Assistant blocked by course AI rules' : 'Assistant query', `user:${a.userId}`,
      `rule: ${decision.rule}${decision.course ? ` (${decision.course})` : ''}; ${top.length} sources in scope${withheldNote ? `; withheld ${withheldNote}` : ''}${answer ? ', answer written' : ''}`, 'Member', true);
    return {
      available: true, allowed, scope, policy, sources: top, answer, confidence, limits,
      decision, withheld: withheldNote || null, mode: input.mode ? specialistByKey(input.mode)?.label ?? null : null,
    };
  },
});
