import { useStore } from '../state/store';
import type { Screen } from '../lib/types';
import { AgentPicker } from '../intelligence/AgentPicker';
import { IntegrityModePicker } from '../intelligence/ModePicker';
import type { IntegrityMode } from '../intelligence/contracts';
import type { HelpState } from './converse';

/**
 * What to say when help is not available, one state at a time.
 *
 * Every entry answers the question the Ask tab has to answer before any
 * other: what can Semester help with right now? A title that names the
 * situation, one sentence on why and what still works, and actions that go
 * somewhere. None of them reads as an error unless something failed — a
 * school or a course that switched AI help off is a boundary, not a fault.
 */
function copyFor(help: Exclude<HelpState, { kind: 'ready' }>): {
  title: string;
  body: string;
  line: string;
} {
  switch (help.kind) {
    case 'checking':
      return {
        title: 'Checking what your school allows',
        body: 'Semester reads your university’s AI policy before it answers. This usually takes a moment.',
        line: 'Waiting for your university’s AI policy before sending.',
      };
    case 'unreachable':
      return {
        title: 'Semester couldn’t reach your university’s AI policy',
        body:
          'Course help waits until it can confirm what your school allows, so nothing is sent in the meantime. ' +
          'Your deadlines, calendar and study tools still work.',
        line: 'Sending is paused until your university’s AI policy can be read.',
      };
    case 'school-off':
      return {
        title: 'Course help is not enabled yet',
        body:
          'Your university has not turned on Semester Intelligence for your account. You can still use your ' +
          'planning tools, review your course materials, or ask your instructor what support is allowed.',
        line: 'Your university has not enabled Semester Intelligence, so messages cannot be sent.',
      };
    case 'course-off':
      return {
        title: `AI help is off for ${help.course}`,
        body:
          `The AI policy you recorded for ${help.course} does not allow AI help with its work. ` +
          'Semester can still help you plan your time and find what is due.' +
          (help.instead.length ? ` Instead, try: ${help.instead.join(', ')}.` : ''),
        line: `Planning help only — ${help.course}’s AI policy does not allow help with its work.`,
      };
  }
}

function actionsFor(help: Exclude<HelpState, { kind: 'ready' }>): { label: string; go: Screen | 'retry' }[] {
  switch (help.kind) {
    case 'checking':
      return [];
    case 'unreachable':
      return [
        { label: 'Try again', go: 'retry' },
        { label: 'See your deadlines', go: 'calendar' },
        { label: 'Open Study', go: 'study' },
      ];
    case 'school-off':
      return [
        { label: 'See your deadlines', go: 'calendar' },
        { label: 'Open Study', go: 'study' },
        { label: 'How this works', go: 'help' },
      ];
    case 'course-off':
      return [
        { label: 'Open the course guide', go: 'guide' },
        { label: 'See your deadlines', go: 'calendar' },
      ];
  }
}

/**
 * The state, with its reason and its ways out.
 *
 * `full` is the panel: title, reason, actions. `line` is the one sentence
 * that sits directly above a disabled composer and is named as its
 * description, so the reason is attached to the control it explains.
 */
export function HelpNotice({
  help,
  id,
  variant = 'full',
  onRetry,
}: {
  help: Exclude<HelpState, { kind: 'ready' }>;
  id?: string;
  variant?: 'full' | 'line';
  onRetry: () => void;
}) {
  const { dispatch } = useStore();
  const copy = copyFor(help);
  if (variant === 'line') {
    return (
      <p id={id} className="ask-help-line" role="status">
        {copy.line}
      </p>
    );
  }
  const actions = actionsFor(help);
  return (
    <section
      className="ask-help"
      data-kind={help.kind}
      aria-labelledby={id ? `${id}-title` : undefined}
      role={help.kind === 'unreachable' ? 'alert' : undefined}
    >
      <h2 id={id ? `${id}-title` : undefined} className="ask-help-title">
        {copy.title}
      </h2>
      <p id={id} className="ask-help-body">
        {copy.body}
      </p>
      {actions.length > 0 && (
        <div className="ask-help-actions">
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'} ask-help-action`}
              onClick={() => (a.go === 'retry' ? onRetry() : dispatch({ type: 'go', screen: a.go }))}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The strip above the composer, on both surfaces.
 *
 * The mode picker when there are modes to pick. Otherwise the reason there
 * are none — never five disabled pills with a grey sentence under them.
 */
export function HowItHelps({
  help,
  requested,
  allowed,
  reason,
  onChange,
  onRetry,
  noticeId,
  noticeVariant,
}: {
  help: HelpState;
  requested: IntegrityMode;
  allowed: IntegrityMode[];
  reason: string;
  onChange: (mode: IntegrityMode) => void;
  onRetry: () => void;
  noticeId: string;
  noticeVariant: 'full' | 'line';
}) {
  if (help.kind === 'ready') {
    return <><AgentPicker /><IntegrityModePicker requested={requested} policy={{ allowed, reason }} onChange={onChange} /></>;
  }
  return <HelpNotice help={help} id={noticeId} variant={noticeVariant} onRetry={onRetry} />;
}
