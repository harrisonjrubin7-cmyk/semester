import { useMemo, useState } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import { CALM_KEY, EMPTY_CALM, calmOrDefault } from '../lib/calm-controls';
import {
  EMPTY_SUPPRESSIONS,
  SUPPRESS_KEY,
  confirmationFor,
  guideBar,
  readSuppressions,
  suppress,
  visiblePriority,
  type GuidePriority,
  type Surface,
} from '../lib/guide-bar';
import { nextTodayDecision, pathSnapshot } from '../lib/today-decision';
import { upcomingItems } from '../lib/select';
import { ownedScope } from '../lib/standing';
import { useNow, useStore } from '../state/store';
import { GuideBar } from './GuideBar';

/**
 * The Semester Guide on Today: the one priority, the count of what is near, and
 * the student's own Snooze / Not now.
 *
 * It reads the same facts as the briefing below it (`nextTodayDecision`) and
 * adds nothing the student has not already recorded. Choices are stored on
 * this device against the suggestion's id; they change what the Guide shows,
 * never the plan or any record.
 */
export function TodayGuide({ surface = 'today' }: { surface?: Surface }) {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const calmLib = useDeviceLibrary(CALM_KEY, calmOrDefault, EMPTY_CALM);
  const choices = useDeviceLibrary(SUPPRESS_KEY, readSuppressions, EMPTY_SUPPRESSIONS);
  const [said, setSaid] = useState<string | null>(null);

  const path = useMemo(() => pathSnapshot(state.requirements, state.taken), [state.requirements, state.taken]);
  const ownIds = useMemo(() => state.courses.map((c) => c.course.id), [state.courses]);
  const scope = useMemo(
    () => ownedScope(upcomingItems(catalog, now), ownIds, state.sample, catalog.empty),
    [catalog, now, ownIds, state.sample],
  );
  const reviewDue = useMemo(
    () => Object.values(state.reviews).filter((r) => r.due <= now.getTime()).length,
    [state.reviews, now],
  );
  const decision = useMemo(
    () => nextTodayDecision({ path, upcoming: scope.items, done: state.done, reviewDue, catalogEmpty: scope.empty }),
    [path, scope, state.done, reviewDue],
  );
  const deadlines = useMemo(() => scope.items.filter((i) => i.daysAway <= 7 && !state.done[i.id]).length, [scope, state.done]);

  const priority: GuidePriority | null = useMemo(
    () =>
      visiblePriority(
        {
          id: decision.id,
          title: decision.title,
          why: decision.why,
          source: decision.source,
          deadlineLabel: decision.itemId ? decision.body.split('.')[0] : null,
          fallback: !decision.itemId && decision.id.startsWith('path:complete'),
          primaryLabel: decision.action,
        },
        choices.value,
        now.getTime(),
      ),
    [decision, choices.value, now],
  );

  const model = guideBar({
    surface,
    priority,
    counts: { deadlines, planDecisions: path.state === 'review' ? 1 : 0, continuations: reviewDue > 0 ? 1 : 0 },
    calm: calmLib.value,
  });

  return (
    <GuideBar
      model={model}
      confirmation={said}
      onAction={(kind) => {
        if (kind === 'primary') {
          if (decision.itemId) dispatch({ type: 'openItem', id: decision.itemId });
          else dispatch({ type: 'go', screen: decision.destination });
          return;
        }
        if (!model.suggestionId) return;
        const at = now.getTime();
        choices.update((v) => suppress(v, model.suggestionId as string, kind, at));
        setSaid(confirmationFor(kind, at));
      }}
    />
  );
}
