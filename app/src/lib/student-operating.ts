/** Student-entered planning only. Never passed to routine AI or institutional analytics. */
export const MANUAL_VERSION = 1;
export type Structure = 'low' | 'medium' | 'high' | 'none';
export type EntryKind = 'plan' | 'decision' | 'waiting' | 'meeting' | 'project' | 'evidence' | 'playbook' | 'group' | 'service';
export interface Manual {
  style: 'simple' | 'daily' | 'weekly' | 'project' | 'explore';
  minutes: 2 | 5 | 10 | 25 | 45;
  format: 'checklist' | 'timeline' | 'map' | 'plain';
  stuck: string;
  notifications: 'none' | 'essential' | 'daily' | 'weekly';
  quiet: boolean;
  noOpportunities: boolean;
  noAnalytics: boolean;
  noStudyBlocks: boolean;
  planningTime: string;
  breaks: string;
  expires: string;
}
export interface OperatingEntry {
  id: string;
  kind: EntryKind;
  title: string;
  done: string;
  next: string;
  deadline: string;
  status: 'planned' | 'moving' | 'waiting' | 'blocked' | 'done';
  owner: string;
  context: string;
  obstacle: string;
  response: string;
  assumptions: string;
  reflection: string;
  support: string;
  steps: string;
  submitted: string;
  reviewed: string;
}
export interface OperatingWorkspace {
  version: 1;
  manual: Manual | null;
  entries: OperatingEntry[];
}
export const defaultManual = (): Manual => ({ style: 'daily', minutes: 10, format: 'checklist', stuck: 'smaller_step', notifications: 'none', quiet: false, noOpportunities: true, noAnalytics: true, noStudyBlocks: true, planningTime: '', breaks: '', expires: '' });
export const emptyOperating = (): OperatingWorkspace => ({ version: 1, manual: null, entries: [] });
export const emptyEntry = (kind: EntryKind): OperatingEntry => ({ id: crypto.randomUUID(), kind, title: '', done: '', next: '', deadline: '', status: 'planned', owner: '', context: '', obstacle: '', response: '', assumptions: '', reflection: '', support: '', steps: '', submitted: '', reviewed: '' });
const KINDS = ['plan', 'decision', 'waiting', 'meeting', 'project', 'evidence', 'playbook', 'group', 'service'];
export function readOperating(raw?: string | null): OperatingWorkspace {
  if (!raw) return emptyOperating();
  try {
    const w = JSON.parse(raw);
    if (w.version !== 1 || !Array.isArray(w.entries)) return emptyOperating();
    const entries = w.entries.filter((e: OperatingEntry) => e && KINDS.includes(e.kind) && ['planned', 'moving', 'waiting', 'blocked', 'done'].includes(e.status) && Object.values(e).every(v => typeof v === 'string') && ['id','title','done','next','deadline','owner','context','obstacle','response','assumptions','reflection','support','steps','submitted','reviewed'].every(k => typeof e[k as keyof OperatingEntry] === 'string'));
    const m = w.manual;
    const valid = m && ['simple','daily','weekly','project','explore'].includes(m.style) && [2,5,10,25,45].includes(m.minutes) && ['checklist','timeline','map','plain'].includes(m.format) && ['none','essential','daily','weekly'].includes(m.notifications) && ['quiet','noOpportunities','noAnalytics','noStudyBlocks'].every(k => typeof m[k] === 'boolean') && ['stuck','planningTime','breaks','expires'].every(k => typeof m[k] === 'string');
    return { version: 1, entries, manual: valid ? m : null };
  } catch { return emptyOperating(); }
}
export function activeManual(manual: Manual | null, today: string): Manual | null {
  return manual && (!manual.expires || manual.expires >= today) ? manual : null;
}
export function visibleEntries(entries: OperatingEntry[], structure: Structure): OperatingEntry[] {
  const open = entries.filter(e => e.status !== 'done');
  return structure === 'low' ? open.slice(0, 1) : structure === 'medium' ? open.slice(0, 3) : open;
}
export function critic(entry: OperatingEntry): { message: string; because: string }[] {
  const result: { message: string; because: string }[] = [];
  const add = (message: string, because: string) => result.push({ message, because });
  if (!entry.done.trim()) add('Define what done looks like.', 'This plan has no definition of done.');
  if (!entry.next.trim()) add('Choose one small first action.', 'You have not entered a next step.');
  if (!entry.deadline) add('Add a date or mark timing as an assumption.', 'No date was selected.');
  if (entry.obstacle && !entry.response) add('Add an if–then fallback.', 'You named an obstacle without a response.');
  if (['waiting','blocked'].includes(entry.status) && !entry.owner) add('Name the dependency owner.', 'This item depends on someone, but no owner was entered.');
  if (!entry.context) add('Attach the prompt or source before relying on the plan.', 'No context was selected.');
  if (entry.kind === 'service' && !entry.reviewed) add('Confirm the service details with its official owner.', 'This packet has no review date.');
  return result;
}
export function exportOperating(workspace: OperatingWorkspace) {
  return { export_version: '1.0', generated_at: new Date().toISOString(), student_preferences: workspace.manual, private_plans: workspace.entries, shared_objects: [], source_references: workspace.entries.filter(e => e.context).map(e => ({ object: e.id, references: e.context })), consent: [], audit: [], boundary: 'Student-entered only; no inferred scores; no external actions or shares executed.' };
}
export function operatingMarkdown(w: OperatingWorkspace): string {
  return '# My Student Operating Manual\n\nPrivate, student-entered workspace.\n\n' + (w.manual ? '## Preferences\n\n' + Object.entries(w.manual).map(([k,v]) => `- ${k}: ${v}`).join('\n') : 'No saved preferences.') + '\n\n' + w.entries.map(e => `## ${e.title}\n\n` + Object.entries(e).filter(([k]) => !['id','title'].includes(k)).map(([k,v]) => `- ${k}: ${v}`).join('\n')).join('\n\n');
}
export function operatingCsv(w: OperatingWorkspace): string {
  const columns: (keyof OperatingEntry)[] = ['kind','title','status','done','next','deadline','owner','context','obstacle','response','assumptions','reflection','support','steps','submitted','reviewed'];
  // Spreadsheet formulas must not execute when a student opens an export.
  const cell = (value: string) => '"' + (/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"','""') + '"';
  return [columns.join(','), ...w.entries.map(e => columns.map(k => cell(e[k])).join(','))].join('\r\n');
}
export const PLAYBOOKS = {
  'Quantitative exam': 'List concepts from approved sources\nDo five retrieval questions\nMark uncertain concepts\nPrepare analogous practice\nWrite one office-hours question\nChoose two later reviews',
  'Essay or research': 'Read prompt and rubric\nChoose a research question\nEvaluate sources\nWrite outline\nDraft\nAsk for feedback\nRevise\nSubmit through official system',
  'Office hours': 'Name the desired outcome\nGather current attempt and prompt\nWrite one question\nAttend\nSave decisions and next action',
  'Registration': 'Read official requirements\nList assumptions\nCompare schedule options\nPrepare advisor questions\nConfirm with official audit\nRegister in official system',
  'Internship application': 'Read requirements\nSelect evidence\nUpdate resume\nDraft response\nReview\nSubmit in official system',
  'Return after disruption': 'Choose one meaningful outcome\nKeep one essential deadline\nReduce the first step to two minutes\nName what is waiting\nChoose a human-support route',
  'Lab report': 'Read protocol and rubric\nGather data\nDescribe method\nAnalyze results\nCheck limitations\nReview and submit',
  'Reading-heavy course': 'List assigned sources\nRead one section\nCapture a key claim\nWrite a retrieval question\nReview uncertain concepts',
  'Group project': 'Agree on outcome\nChoose editable roles\nAssign milestone owners and dates\nRecord decisions\nPrepare respectful follow-up\nReview together',
  'Scholarship application': 'Confirm eligibility officially\nGather documents\nDraft statement\nRequest feedback\nReview deadline\nSubmit officially',
  'Study abroad': 'Read official program requirements\nList cost and credit assumptions\nPrepare advisor questions\nConfirm transfer rules\nGather documents\nApply officially',
  'Tutoring': 'Choose course and topic\nGather prompt and current attempt\nWrite one question\nOpen official booking\nAttend\nSave next action',
} as const;

export function operatingIcs(title: string, date: string, minutes: number): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || !Number.isFinite(minutes) || minutes < 1) throw new Error('Choose a local start time and positive duration.');
  const start = new Date(date);
  const local = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}T${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
  if (!Number.isFinite(start.getTime()) || local !== date) throw new Error('Choose a valid date.');
  const stamp = (d: Date) => d.toISOString().replaceAll('-','').replaceAll(':','').replace(/\.\d{3}/,'');
  const escaped = title.replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll('\r','').replaceAll(',','\\,').replaceAll(';','\\;');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Semester//Student planning//EN','BEGIN:VEVENT',`UID:${crypto.randomUUID()}@semester`, `DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(start.getTime() + minutes * 60000))}`,`SUMMARY:${escaped}`,'CLASS:PRIVATE','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
