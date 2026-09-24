// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../../data/seed';
import { PREVIEW_ROLES, type PreviewRole } from '../../data/institutional-preview';
import { StoreProvider } from '../../state/store';
import { InstitutionalPreviewProvider, useInstitutionalPreview } from './PreviewContext';
import { RoleWorkspace } from './RoleWorkspace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeAll(() => loadSeed());

function RoleChooser({ role }: { role: PreviewRole }) {
  const { institution, selectPerson } = useInstitutionalPreview();
  return (
    <button type="button" onClick={() => selectPerson(institution.people.find((person) => person.role === role)!.id)}>
      Choose {role}
    </button>
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

function renderRole(role: PreviewRole) {
  act(() => {
    root.render(
      <StoreProvider>
        <InstitutionalPreviewProvider>
          <RoleChooser role={role} />
          <RoleWorkspace />
        </InstitutionalPreviewProvider>
      </StoreProvider>,
    );
  });
  act(() => host.querySelector<HTMLButtonElement>(`button`)?.click());
}

describe('role-aware University workspace', () => {
  it('gives the student a personal, synthetic summary', () => {
    renderRole('student');
    expect(host.textContent).toContain('Student workspace');
    expect(host.textContent).toContain('Your sample plan and evidence only');
  });

  it('lets faculty prepare but not publish assignment and feedback drafts', () => {
    renderRole('faculty');
    expect(host.textContent).toContain('Faculty workspace');
    expect(host.textContent).toContain('Prepare assignment draft');
    expect(host.textContent).toContain('Nothing is published to a learning system');
    const prepare = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Prepare assignment draft',
    );
    act(() => prepare?.click());
    expect(host.textContent).toContain('Assignment draft prepared locally');
    expect(host.textContent).toContain('Nothing was published or sent');
  });

  it('gives teaching assistants course-support functions without publishing or grading authority', () => {
    renderRole('teaching_assistant');
    expect(host.textContent).toContain('Teaching-assistant workspace');
    expect(host.textContent).toContain('Prepare learning activities');
    expect(host.textContent).toContain('Prepare office-hours support');
    expect(host.textContent).toContain('No grade or course change is published');
  });

  for (const role of ['advisor', 'campus_staff'] as const) {
    it(`locks unconsented student detail for ${role}`, () => {
      renderRole(role);
      expect(host.textContent).toContain(role === 'advisor' ? 'Advisor workspace' : 'Student-success workspace');
      expect(host.textContent).toContain('Sample student A · workload review');
      expect(host.textContent).toContain('Locked · sample consent required');
    });
  }

  it('labels administrator controls illustrative and unavailable integrations honestly', () => {
    renderRole('university_admin');
    expect(host.textContent).toContain('Administrator workspace');
    expect(host.textContent).toContain('Illustrative settings · server enforcement required');
    expect(host.textContent).toContain('Payments · unavailable');
  });

  for (const [role, label] of [
    ['moderator', 'Community moderation workspace'],
    ['employer', 'Employer workspace'],
    ['authorized_payer', 'Authorized payer workspace'],
  ] as const) {
    it(`keeps ${role} scoped away from student academic detail`, () => {
      renderRole(role);
      expect(host.textContent).toContain(label);
      expect(host.textContent).toContain('No student academic details are shown');
      expect(host.textContent).not.toContain('Research brief');
    });
  }

  for (const [role, label, functionName] of [
    ['applicant', 'Applicant workspace', 'Track my application preparation'],
    ['authorized_family', 'Authorized-family workspace', 'Review explicitly shared updates'],
    ['alumni', 'Alumni workspace', 'Prepare a mentorship profile'],
  ] as const) {
    it(`presents applicable, privacy-scoped functions for ${role}`, () => {
      renderRole(role);
      expect(host.textContent).toContain(label);
      expect(host.textContent).toContain(functionName);
      expect(host.textContent).not.toContain('Research brief');
    });
  }

  it('shows a named function list for every preview role', () => {
    for (const role of PREVIEW_ROLES) {
      renderRole(role);
      expect(host.querySelector('[aria-label="Available functions"]'), role).not.toBeNull();
    }
  });
});
