import { useState } from 'react';
import { ActionButton, SectionLabel } from './ui';
import { secondLine } from '../lib/dim';
import {
  LEARNER_PATHWAYS,
  suggestLine,
  loadChosen,
  saveChosen,
  type LearnerPathwayId,
} from '../lib/learner-pathways';

/**
 * "Pathways that fit you", on the Pathway screen.
 *
 * Takes a storage key and a way to start a checklist, and nothing else — no
 * store, no profile, no record. What it knows about the student is exactly
 * what they tick here. See `lib/learner-pathways.ts` for why that is the rule.
 */
export function LearnerPathways({ storageKey, onStart }: { storageKey: string; onStart: (kind: string) => void }) {
  const [chosen, setChosen] = useState<LearnerPathwayId[]>(() => loadChosen(storageKey));
  const [kept, setKept] = useState(true);

  const toggle = (id: LearnerPathwayId, on: boolean) => {
    const next = on ? [...chosen, id] : chosen.filter((x) => x !== id);
    setChosen(next);
    setKept(saveChosen(storageKey, next));
  };

  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;
  const small = { fontSize: 'var(--type-sm)', ...secondLine() } as const;

  return (
    <section aria-labelledby="learner-pathways-heading">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>
        <span id="learner-pathways-heading">Pathways that fit you</span>
      </SectionLabel>
      <p style={body}>
        Tick any that describe you, or none. It stays on this device: no office, instructor or supporter can see it,
        and it changes only which checklists and filters are offered here — never a deadline or a record.
      </p>
      {!kept && (
        <p role="status" style={small}>
          Your browser would not keep this, so it lasts until you leave.
        </p>
      )}

      <fieldset style={{ border: 0, padding: 0, margin: 'var(--sp-4) 0 0' }}>
        <legend className="sr-only">Pathways that describe you</legend>
        {LEARNER_PATHWAYS.map((p) => (
          <label
            key={p.id}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)', ...body }}
          >
            <input
              type="checkbox"
              checked={chosen.includes(p.id)}
              onChange={(e) => toggle(p.id, e.target.checked)}
              style={{ marginTop: 'var(--sp-2)' }}
            />
            <span>
              {p.label}
              <span style={{ display: 'block', ...small }}>{p.blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {LEARNER_PATHWAYS.filter((p) => chosen.includes(p.id)).map((p) => (
        <div key={p.id} style={{ marginTop: 'var(--sp-6)' }}>
          <SectionLabel style={{ marginBlock: 'var(--sp-4)' }}>{p.label}</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {p.templates.map((t) => (
              <ActionButton
                key={t}
                onClick={() => onStart(t)}
                aria-label={`Start the ${t} checklist`}
                style={{ width: 'auto', paddingInline: 'var(--sp-6)' }}
              >
                {`Start: ${t}`}
              </ActionButton>
            ))}
          </div>
          <p style={{ ...small, marginTop: 'var(--sp-4)' }}>Who decides:</p>
          <ul style={{ ...body, marginTop: 'var(--sp-2)', paddingInlineStart: 'var(--sp-7)' }}>
            {p.ask.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {p.suggest && <p style={{ ...small, marginTop: 'var(--sp-4)' }}>{suggestLine(p.suggest)}</p>}
        </div>
      ))}
    </section>
  );
}
