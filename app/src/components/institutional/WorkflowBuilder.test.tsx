// @vitest-environment jsdom
/**
 * The Workflow Builder, driven through an injected client. The client is the
 * only fake, and it keeps the database's rules by calling the same `problems`
 * the screen reads and by refusing the drafter a publish — so what the screen
 * offers is what the fake allows, and a refusal comes back in the trigger's
 * own words. The screen, its copy, its gating and the preview engine are the
 * shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { current, refusal, type WorkflowApi, type WorkflowVersion } from '../../lib/workflow/api';
import { problems, type Definition, type WorkflowKey } from '../../lib/workflow/spec';
import { TEMPLATES } from '../../lib/workflow/templates';
import { WorkflowBuilder } from './WorkflowBuilder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EDITOR = 'user-editor';
const REGISTRAR = 'user-registrar';
const T = '2026-10-01T00:00:00.000Z';
const EDIT = ['workflow:manage', 'workflow:view'];
const PUBLISH = ['workflow:publish', 'workflow:view'];
const BOTH = ['workflow:manage', 'workflow:publish', 'workflow:view'];

function published(workflow: WorkflowKey, version: number, definition: Definition, note = ''): WorkflowVersion {
  return {
    id: `${workflow}-${version}`, tenant_id: 'vu', workflow, state: 'published', version, definition, note, based_on: null,
    created_by: EDITOR, published_by: REGISTRAR, created_at: T, updated_at: T, published_at: T,
  };
}
function draftRow(workflow: WorkflowKey, definition: Definition, by = EDITOR): WorkflowVersion {
  return {
    id: `${workflow}-draft`, tenant_id: 'vu', workflow, state: 'draft', version: null, definition, note: '', based_on: null,
    created_by: by, published_by: null, created_at: T, updated_at: T, published_at: null,
  };
}

/** An in-memory table that refuses what the trigger refuses. */
function fake(start: WorkflowVersion[], viewer: string) {
  let rows = [...start];
  const api = {
    list: vi.fn(async () => rows),
    saveDraft: vi.fn(async (_t: string, workflow: WorkflowKey, definition: Definition, note: string, basedOn: number | null, existing: WorkflowVersion | null) => {
      const bad = problems(definition);
      if (bad.length) throw refusal({ message: `This workflow is not valid: ${bad.join(', ')}` }, '');
      if (existing) rows = rows.map((r) => (r.id === existing.id ? { ...r, definition, note, based_on: basedOn, updated_at: `${T}#${rows.length}` } : r));
      else rows = [...rows, { ...draftRow(workflow, definition, viewer), note, based_on: basedOn }];
    }),
    discardDraft: vi.fn(async (id: string) => {
      rows = rows.filter((r) => r.id !== id);
    }),
    publish: vi.fn(async (d: WorkflowVersion) => {
      if (d.created_by === viewer) throw refusal({ message: 'Whoever drafted a workflow does not publish it.' }, '');
      const next = (current(rows, d.workflow)?.version ?? 0) + 1;
      rows = rows.map((r) => (r.id === d.id ? { ...r, state: 'published' as const, version: next, published_by: viewer, published_at: T } : r));
    }),
  };
  return api as unknown as WorkflowApi & Record<keyof WorkflowApi, ReturnType<typeof vi.fn>>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(api: WorkflowApi, viewerId: string, holds: readonly string[]) {
  await act(async () => {
    root.render(<WorkflowBuilder tenantId="vu" viewerId={viewerId} holds={holds} api={api} />);
  });
}
const button = (re: RegExp) => [...host.querySelectorAll('button')].find((b) => re.test(b.textContent ?? '') || re.test(b.getAttribute('aria-label') ?? '')) as HTMLButtonElement | undefined;
async function click(el: HTMLElement | undefined) {
  expect(el, 'control not found').toBeTruthy();
  await act(async () => el!.click());
}
function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function choose(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
const control = (name: string) => host.querySelector(`[aria-label="${name}"]`) as HTMLInputElement & HTMLSelectElement;
const open = (name: RegExp) => click(button(name));

describe('the workflow list', () => {
  it('lists the ten workflows and says, first, that it holds definitions and runs none', async () => {
    await mount(fake([], EDITOR), EDITOR, EDIT);
    for (const w of ['Registration clearance checklist', 'Advisor approval request', 'Transfer-credit review packet', 'Study-abroad course approval', 'Tutoring referral',
      'Scholarship deadline', 'Student organization event request', 'Internship approval', 'Course substitution request', 'Graduation application preparation']) {
      expect(button(new RegExp(`^${w}`)), w).toBeTruthy();
    }
    expect(host.textContent).toContain('no student, request or answer is stored here');
    expect(host.textContent).toContain('Nothing in the app runs these definitions yet');
  });

  it('shows each workflow’s version, or that it is not defined, and whether a draft waits', async () => {
    await mount(fake([published('advisor_approval', 2, TEMPLATES.advisor_approval), draftRow('tutoring_referral', TEMPLATES.tutoring_referral)], EDITOR), EDITOR, EDIT);
    expect(button(/^Advisor approval request/)!.textContent).toContain('Version 2');
    expect(button(/^Scholarship deadline/)!.textContent).toContain('Not defined');
    expect(button(/^Tutoring referral/)!.textContent).toContain('draft waiting');
  });

  it('says so when the school can’t be reached', async () => {
    const api = { ...fake([], EDITOR), list: vi.fn(async () => { throw new Error('Could not load the workflows.'); }) } as unknown as WorkflowApi;
    await mount(api, EDITOR, EDIT);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not load the workflows.');
  });
});

describe('drafting', () => {
  it('starts from the template for that workflow, and saves it as a draft the editor cannot publish', async () => {
    const api = fake([], EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Registration clearance/);
    expect(host.textContent).toContain('placeholders to change');
    await click(button(/Start from the template/));
    expect((control('Step 1 title')).value).toBe('Check what registration needs');
    await act(async () => type(host.querySelector('input.input') as HTMLInputElement, 'Registration clearance, our version'));
    await click(button(/Start a draft/));
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    const [, wf, def, , basedOn, existing] = api.saveDraft.mock.calls[0] as [string, WorkflowKey, Definition, string, number | null, unknown];
    expect(wf).toBe('registration_clearance');
    expect(def.title).toBe('Registration clearance, our version');
    expect(def.steps).toHaveLength(TEMPLATES.registration_clearance.steps.length);
    expect(basedOn).toBeNull();
    expect(existing).toBeNull();
    expect(host.textContent).toContain('Draft saved.');
    expect(button(/Publish as version/)).toBeUndefined();
  });

  it('stops a definition the database would refuse before it is sent', async () => {
    const api = fake([published('advisor_approval', 1, TEMPLATES.advisor_approval)], EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Advisor approval request/);
    // Turn the last step into a notification: a workflow must end by completing.
    await act(async () => choose(control('Step 5 kind'), 'notify'));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('The last step must be “Complete”');
    await act(async () => type(control('Step 1 title'), 'Check you can ask, again'));
    expect((button(/Start a draft/) as HTMLButtonElement).disabled).toBe(true);
    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('adds a step before the closing one, and a check that reads a fact from the list', async () => {
    const api = fake([published('advisor_approval', 1, TEMPLATES.advisor_approval)], EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Advisor approval request/);
    const before = host.querySelectorAll('[aria-label$="kind"]').length;
    await click(button(/Add a step/));
    expect(host.querySelectorAll('[aria-label$="kind"]').length).toBe(before + 1);
    // The new step sits above "Complete", which stays last.
    expect((control(`Step ${before + 1} kind`)).value).toBe('complete');
    expect((control(`Step ${before} kind`)).value).toBe('notify');
    await click(button(/Add a check/));
    expect(control('Check 3 fact').value).toBe('program_enrolled');
    expect([...control('Check 3 fact').options].map((o) => o.value)).not.toContain('final_grade');
  });

  it('gives an int fact a number and a comparison that fits, and a bool fact a yes or no', async () => {
    await mount(fake([published('study_abroad_approval', 1, TEMPLATES.study_abroad_approval)], EDITOR), EDITOR, EDIT);
    await open(/^Study-abroad course approval/);
    // Check 2 is credits earned, at least 30.
    expect(control('Check 2 fact').value).toBe('credits_earned');
    expect([...control('Check 2 comparison').options].map((o) => o.value)).toEqual(['eq', 'neq', 'gte', 'lte']);
    expect(control('Check 2 value').type).toBe('number');
    expect([...control('Check 1 comparison').options].map((o) => o.value)).toEqual(['eq']);
    expect(control('Check 1 value').tagName).toBe('SELECT');
  });

  it('offers a reader nothing to save', async () => {
    await mount(fake([published('advisor_approval', 1, TEMPLATES.advisor_approval)], 'reader'), 'reader', ['workflow:view']);
    await open(/^Advisor approval request/);
    expect(host.textContent).toContain('cannot draft changes');
    expect(button(/Start a draft|Save draft|Add a step|Add a check/)).toBeUndefined();
    expect(control('Step 1 title').disabled).toBe(true);
  });

  it('shows a reader that a workflow is not defined without offering the template', async () => {
    await mount(fake([], 'reader'), 'reader', ['workflow:view']);
    await open(/^Tutoring referral/);
    expect(host.textContent).toContain('can read workflows and cannot draft them');
    expect(button(/Start from the template/)).toBeUndefined();
  });

  it('discards a draft and returns to the version in force', async () => {
    const changed = { ...TEMPLATES.advisor_approval, title: 'Changed' };
    const api = fake([published('advisor_approval', 1, TEMPLATES.advisor_approval), draftRow('advisor_approval', changed)], EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Advisor approval request/);
    expect((host.querySelector('input.input') as HTMLInputElement).value).toBe('Changed');
    await click(button(/Discard draft/));
    expect(api.discardDraft).toHaveBeenCalledWith('advisor_approval-draft');
    expect((host.querySelector('input.input') as HTMLInputElement).value).toBe(TEMPLATES.advisor_approval.title);
  });
});

describe('publishing', () => {
  it('is refused to whoever drafted it, even holding the role, and says why before pressing', async () => {
    const api = fake([draftRow('advisor_approval', TEMPLATES.advisor_approval, EDITOR)], EDITOR);
    await mount(api, EDITOR, BOTH);
    await open(/^Advisor approval request/);
    expect(host.textContent).toContain('Whoever drafted a workflow does not publish it');
    expect((button(/Publish as version 1/) as HTMLButtonElement).disabled).toBe(true);
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('is done by a colleague, and becomes the next version', async () => {
    const api = fake([published('advisor_approval', 1, TEMPLATES.advisor_approval), draftRow('advisor_approval', { ...TEMPLATES.advisor_approval, title: 'Slower' }, EDITOR)], REGISTRAR);
    await mount(api, REGISTRAR, PUBLISH);
    await open(/^Advisor approval request/);
    await click(button(/Publish as version 2/));
    expect(api.publish).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Published.');
    expect(host.textContent).toContain('In force: version 2');
  });

  it('waits for the draft to be saved as it will be reviewed', async () => {
    const api = fake([draftRow('advisor_approval', TEMPLATES.advisor_approval, EDITOR)], REGISTRAR);
    await mount(api, REGISTRAR, BOTH);
    await open(/^Advisor approval request/);
    expect((button(/Publish as version 1/) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => type(control('Step 1 title'), 'Changed by the publisher'));
    expect(host.textContent).toContain('Save the draft first');
    expect((button(/Publish as version 1/) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the preview', () => {
  it('tells an imagined student what stands in the way, in the definition’s own words', async () => {
    await mount(fake([published('registration_clearance', 1, TEMPLATES.registration_clearance)], EDITOR), EDITOR, EDIT);
    await open(/^Registration clearance/);
    const text = () => host.textContent ?? '';
    // Nothing known: not eligible and not ineligible.
    expect(text()).toContain('Semester cannot tell yet');
    const enrolled = [...host.querySelectorAll('label')].find((l) => /Enrolled in a program/.test(l.textContent ?? ''))!.querySelector('select') as HTMLSelectElement;
    await act(async () => choose(enrolled, 'no'));
    expect(text()).toContain('One thing stands in the way');
    expect(text()).toContain('You need to be enrolled in a program to use this.');
    expect(text()).toContain('Next: Ask the registrar to confirm your enrollment.');
  });

  it('says a student is clear only when every check is met', async () => {
    await mount(fake([published('registration_clearance', 1, TEMPLATES.registration_clearance)], EDITOR), EDITOR, EDIT);
    await open(/^Registration clearance/);
    const pick = (re: RegExp, v: string) => act(async () => choose([...host.querySelectorAll('label')].find((l) => re.test(l.textContent ?? ''))!.querySelector('select') as HTMLSelectElement, v));
    await pick(/Enrolled in a program/, 'yes');
    await pick(/The term is active/, 'yes');
    await pick(/A hold is present/, 'no');
    expect(host.textContent).toContain('You meet what this needs');
  });

  it('names the office at the handoff and does not run anything', async () => {
    await mount(fake([published('registration_clearance', 1, TEMPLATES.registration_clearance)], EDITOR), EDITOR, EDIT);
    await open(/^Registration clearance/);
    expect(host.textContent).toContain('Handed to Office of the Registrar. That office keeps the official record.');
  });
});

describe('history and rollback', () => {
  const rows = [
    published('advisor_approval', 1, TEMPLATES.advisor_approval, 'first'),
    published('advisor_approval', 2, { ...TEMPLATES.advisor_approval, title: 'Second' }, 'slower'),
  ];

  it('lists versions newest first with what each holds', async () => {
    await mount(fake(rows, EDITOR), EDITOR, EDIT);
    await open(/^Advisor approval request/);
    const text = host.textContent ?? '';
    expect(text.indexOf('Version 2')).toBeLessThan(text.indexOf('Version 1'));
    expect(text).toContain('5 steps · 2 checks');
    expect(text).toContain('slower');
  });

  it('loads an older version into the form, to be drafted and published like any other', async () => {
    const api = fake(rows, EDITOR);
    await mount(api, EDITOR, EDIT);
    await open(/^Advisor approval request/);
    await click(button(/Start from version 1/));
    expect((host.querySelector('input.input') as HTMLInputElement).value).toBe(TEMPLATES.advisor_approval.title);
    expect(host.textContent).toContain('a colleague publishes it as the next version');
    await click(button(/Start a draft/));
    expect(api.saveDraft).toHaveBeenCalledWith('vu', 'advisor_approval', TEMPLATES.advisor_approval, 'Back to version 1', 1, null);
  });

  it('offers no rollback to a reader', async () => {
    await mount(fake(rows, 'reader'), 'reader', ['workflow:view']);
    await open(/^Advisor approval request/);
    expect(button(/Start from version/)).toBeUndefined();
  });
});
