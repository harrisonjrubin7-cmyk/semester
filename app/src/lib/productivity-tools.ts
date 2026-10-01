import {
  advisorPacket,
  id,
  type Capture,
  type Decision,
  type Productivity,
} from './productivity';
import { blankDoc, fromMarkdown } from './document';
import { toIcs } from './export';
import type { Piece } from './deliver';

/** Only explicitly authorized material crosses the assistant boundary. */
export function preparationContext(
  workspace: Productivity,
  decisionId: string,
  captureIds: string[],
): string {
  const decision = workspace.decisions.find((x) => x.id === decisionId);
  const sources = workspace.captures
    .filter((x) => x.authorized && captureIds.includes(x.id))
    .slice(0, 20);
  return [
    decision ? advisorPacket(decision) : '',
    ...sources.map(
      (x) =>
        `SOURCE ${x.id}\n${x.title}\n${x.source}\n${x.context.slice(0, 1200)}\n${x.reason.slice(0, 300)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 16000);
}
export interface SemanticHit {
  id: string;
  why: string;
  excerpt: string;
}
export function readSemanticHits(
  raw: string,
  sources: Capture[],
): SemanticHit[] {
  const parsed: unknown = JSON.parse(
    raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim(),
  );
  if (!Array.isArray(parsed) || parsed.length > 20)
    throw new Error(
      'Search response could not be verified. Try a narrower query.',
    );
  const seen = new Set<string>();
  return parsed.map((v) => {
    if (
      !v ||
      typeof v.id !== 'string' ||
      typeof v.why !== 'string' ||
      typeof v.excerpt !== 'string'
    )
      throw new Error('Search response is invalid.');
    const source = sources.find((s) => s.authorized && s.id === v.id);
    if (
      !source ||
      seen.has(v.id) ||
      !v.excerpt.trim() ||
      !`${source.title}\n${source.source}\n${source.context}\n${source.reason}`.includes(
        v.excerpt,
      )
    )
      throw new Error('Search cited content outside the reviewed sources.');
    seen.add(v.id);
    return {
      id: v.id,
      why: v.why.slice(0, 500),
      excerpt: v.excerpt.slice(0, 800),
    };
  });
}
export async function packetPiece(
  text: string,
  format: 'txt' | 'pdf' | 'docx',
): Promise<Piece> {
  const name = `semester-reviewed-packet.${format}`;
  if (format === 'txt') return { name, body: text, mime: 'text/plain' };
  const doc = {
    id: id(),
    ...blankDoc('Reviewed preparation packet'),
    blocks: fromMarkdown(text),
  };
  if (format === 'pdf') {
    const { pdfFile } = await import('./pdfout');
    return { name, body: pdfFile(doc), mime: 'application/pdf' };
  }
  const { docx } = await import('./docx');
  return {
    name,
    body: await docx(doc),
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}
export function revisitFeed(decisions: Decision[]): string {
  return toIcs(
    decisions
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.revisit))
      .map((x) => ({
        uid: `productivity-${x.id}`,
        summary: `Revisit: ${x.title}`,
        description: x.questions,
        date: new Date(`${x.revisit}T12:00:00`),
        alarms: [24 * 60, 60],
      })),
    'Semester decision reviews',
  );
}
export interface PlanBlock {
  title: string;
  date: string;
  at: number;
  minutes: number;
  note: string;
}
export function planBlocks(
  start: string,
  weeks: number,
  hours: number,
  at: number,
  title: string,
  note: string,
): PlanBlock[] {
  const date = new Date(`${start}T12:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(start.slice(0, 4)) ||
    date.getMonth() + 1 !== Number(start.slice(5, 7)) ||
    date.getDate() !== Number(start.slice(8, 10)) ||
    !Number.isInteger(weeks) ||
    weeks < 1 ||
    weeks > 12 ||
    !Number.isFinite(hours) ||
    hours < 0.25 ||
    hours > 8 ||
    !Number.isInteger(at) ||
    at < 0 ||
    at + hours * 60 > 1440 ||
    !title.trim()
  )
    throw new Error(
      'Choose a valid date, 1–12 weeks, and a study block of 15 minutes to 8 hours within the day.',
    );
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 7 * i);
    return {
      title,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      at,
      minutes: Math.round(hours * 60),
      note,
    };
  });
}
