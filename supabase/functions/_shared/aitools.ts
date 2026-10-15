/**
 * The highest data class each tool the app offers a model can carry.
 *
 * The shared key's request body is free text the function does not read, but
 * the tools in it are named, and a named tool has a class: `read_grades` and
 * `read_attendance` return education records (T3), so on this route they are
 * the one way a T3 field reaches a model. `clamp.ts` asks this table before
 * offering a tool and before forwarding a history that holds a tool's answer.
 *
 * It is a copy of the `data` column of `app/src/lib/governance/ai-tools.ts`
 * (`TOOL_RECORDS`), which is where a tool's class is decided: an Edge Function
 * is bundled from this directory alone and cannot import app code, so the copy
 * is held in step by `claudeclass.test.ts`, which fails on a tool in either
 * place and not the other, or on a class that differs. A tool absent from this
 * table is unclassified, and unclassified is T3: it is not offered and its
 * answers are not forwarded.
 *
 * Pure, and free of Deno APIs, so the app's test suite can import it.
 */

import type { DataClass } from './integration/ai-data-class.ts';

export const TOOL_DATA_CLASS: Readonly<Record<string, DataClass>> = {
  find_deadlines: 'T2',
  read_grades: 'T3',
  read_attendance: 'T3',
  search_material: 'T2',
  read_tasks: 'T2',
  read_timetable: 'T2',
  tick_deadline: 'T2',
  add_task: 'T2',
  move_task: 'T2',
  mark_attendance: 'T2',
  start_timer: 'T2',
  add_note: 'T2',
  add_source: 'T2',
  add_application: 'T2',
  set_look: 'T2',
  set_day_budget: 'T2',
  move_application: 'T2',
  set_next_step: 'T2',
  make_document: 'T2',
  make_sheet: 'T2',
  save_equation: 'T2',
  open_screen: 'T2',
};
