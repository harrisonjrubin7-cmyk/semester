import { obj, textValue } from '../device-library';
import { isTemplateId, type TemplateId } from './template-ids';

export interface Workspace {
  id: string;
  template: TemplateId;
  title: string;
  courseCode: string;
  goal: string;
  /** The instructions, pasted by the student. */
  prompt: string;
  notes: Record<string, string>;
  done: string[];
  reflection: string;
  /** Private until the student chooses otherwise; there is no sharing path in this slice. */
  visibility: 'private';
  created: string;
}

export function readWorkspaces(value: unknown): Workspace[] {
  if (!Array.isArray(value)) throw new Error('Assignment workspaces are not a list.');
  return value.map((w) => {
    if (!obj(w) || !textValue(w.id, 80) || !textValue(w.title, 300) || !isTemplateId(w.template))
      throw new Error('An assignment workspace is malformed.');
    const notes: Record<string, string> = {};
    if (obj(w.notes)) for (const [k, v] of Object.entries(w.notes)) if (textValue(v, 20_000)) notes[k] = v;
    return {
      id: w.id,
      template: w.template,
      title: w.title,
      courseCode: textValue(w.courseCode, 40) ? w.courseCode : '',
      goal: textValue(w.goal, 2000) ? w.goal : '',
      prompt: textValue(w.prompt, 20_000) ? w.prompt : '',
      notes,
      done: Array.isArray(w.done) ? w.done.filter((d): d is string => textValue(d, 80)) : [],
      reflection: textValue(w.reflection, 20_000) ? w.reflection : '',
      visibility: 'private',
      created: textValue(w.created, 40) ? w.created : '',
    };
  });
}
