import type { Journey } from '../lib/journeys';
import type { Screen } from '../lib/types';

export function JourneyCards({
  journeys,
  onOpen,
  reasons = {},
}: {
  journeys: Journey[];
  onOpen: (screen: Screen) => void;
  reasons?: Partial<Record<Journey['id'], string>>;
}) {
  return (
    <div className="journey-cards" aria-label="Student journeys">
      {journeys.map((journey, index) => {
        const start = journey.screens[0];
        if (!start) return null;
        return (
          <button
            key={journey.id}
            type="button"
            className="bare journey-card"
            data-journey-id={journey.id}
            onClick={() => onOpen(start)}
          >
            <span className="journey-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="journey-copy">
              <span className="journey-name">{journey.label}</span>
              <span className="journey-outcome">{journey.outcome}</span>
              {reasons[journey.id] && <span className="journey-reason">{reasons[journey.id]}</span>}
            </span>
            <span className="journey-arrow" aria-hidden="true">→</span>
          </button>
        );
      })}
    </div>
  );
}
