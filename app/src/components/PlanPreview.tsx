import { useId, useState } from 'react';
import { FieldMessage, fieldProps } from './FieldMessage';
import { ActionButton } from './ui';
import { readPlanDraft, type PlanDraft, type PlanProblem } from '../lib/planpreview';

/**
 * The registration plan, before an account.
 *
 * A term and the courses being considered. Saving writes them on this device.
 * The sentence under the button is the boundary: an account is for another
 * device, not for seeing the plan, and the plan is not an enrollment.
 */
export function PlanPreview({ onAdded }: { onAdded: (draft: PlanDraft) => void }) {
  const termBox = useId();
  const courseBox = useId();
  const [term, setTerm] = useState('');
  const [courses, setCourses] = useState('');
  const [problem, setProblem] = useState<PlanProblem | null>(null);
  const [saved, setSaved] = useState('');

  const submit = () => {
    const read = readPlanDraft(term, courses);
    if (!read.ok) {
      setProblem(read);
      setSaved('');
      return;
    }
    setProblem(null);
    onAdded(read.draft);
    setSaved(
      `Added ${read.draft.codes.join(', ')} for ${read.draft.term}. This plan is on this device. It is not your school’s registration record.`,
    );
  };

  const termError = problem?.field === 'term' ? problem.error : undefined;
  const courseError = problem?.field === 'courses' ? problem.error : undefined;

  return (
    <form
      aria-label="Build your registration plan"
      style={{ marginTop: 'var(--sp-6)' }}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        <label>
          Term
          <input
            className="input"
            {...fieldProps(termBox, termError)}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <FieldMessage id={termBox} error={termError} />
      </div>
      <div style={{ display: 'grid', gap: 'var(--sp-2)', marginTop: 'var(--sp-5)' }}>
        <label>
          Courses
          <textarea
            className="input"
            {...fieldProps(courseBox, courseError)}
            value={courses}
            onChange={(event) => setCourses(event.target.value)}
            rows={4}
            placeholder="ECON 1020"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <FieldMessage id={courseBox} error={courseError} />
      </div>
      <ActionButton tone="primary" style={{ marginTop: 'var(--sp-5)' }} onClick={submit}>
        Save this plan
      </ActionButton>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        An account is only for keeping this plan on another device. Nothing here is sent to a registrar.
      </p>
      {saved ? (
        <p role="status" style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
          {saved}
        </p>
      ) : null}
    </form>
  );
}
