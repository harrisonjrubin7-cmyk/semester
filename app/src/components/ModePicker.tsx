import { CardGrid, GridCard } from './GridCard';
import type { ModeInfo } from '../lib/modes';
import type { StudyMode } from '../lib/types';

/**
 * All eleven ways through a course, visible at once.
 *
 * The chip row it replaced was one line that scrolled sideways: four ways of
 * studying on screen and seven over the edge, which is a good way to own a
 * feature nobody uses. A wrapping grid fits all eleven on a phone, and each
 * one carries what is actually behind it — "44 lessons", "12 figures", or a
 * plain statement that there is nothing here yet.
 *
 * ## It is the navigation now
 *
 * Under the `guides` navigation this grid is not a control on a screen, it is
 * how you move — there is no tab bar, no rail and no shelf beside it. Two
 * things follow from that and are worth keeping true. It may not be collapsed
 * there (`screens/Guide.tsx` holds the fold open), and the tiles are drawn by
 * the same `GridCard` as the course list on the home screen, so moving
 * between the two levels is visibly the same gesture rather than two
 * different-looking grids that happen to both be tappable.
 */
export function ModePicker({
  modes,
  value,
  onChange,
}: {
  modes: ModeInfo[];
  value: StudyMode;
  onChange: (mode: StudyMode) => void;
}) {
  return (
    <CardGrid>
      {modes.map((m) => (
        <GridCard
          key={m.id}
          label={m.label}
          meta={m.ready ? m.count : 'Empty'}
          selected={m.id === value}
          dim={!m.ready}
          title={m.blurb}
          onClick={() => onChange(m.id)}
        />
      ))}
    </CardGrid>
  );
}
