/**
 * Lucide-style icons, inline at stroke-width 1.5 — the Industry system's rule.
 * Inlined rather than pulled from a package so the whole set is one small file
 * and nothing ships that is not used.
 *
 * The shapes themselves live in `icons.data.ts`, because the website draws the
 * same glyphs as CSS masks and needs them as files. See the note there.
 */

import { SHAPES, STROKE, type IconName, type Shape } from './icons.data';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function draw(shape: Shape, key: number) {
  return 'c' in shape ? (
    <circle key={key} cx={shape.c[0]} cy={shape.c[1]} r={shape.c[2]} />
  ) : (
    <path key={key} d={shape.d} />
  );
}

function svg(name: IconName) {
  return function Icon({ size = 19, className, style }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={STROKE.viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE.width}
        strokeLinecap={STROKE.cap}
        strokeLinejoin={STROKE.join}
        className={className}
        style={{ display: 'block', ...style }}
        aria-hidden="true"
      >
        {SHAPES[name].map(draw)}
      </svg>
    );
  };
}

export const ChevronRight = svg('chevronRight');
export const ChevronLeft = svg('chevronLeft');
export const Search = svg('search');
export const Bell = svg('bell');
export const Person = svg('person');
export const Check = svg('check');
export const Plus = svg('plus');
export const TodayIcon = svg('today');
export const CoursesIcon = svg('courses');
export const StudyIcon = svg('study');
export const NotesIcon = svg('notes');
export const MapIcon = svg('map');
export const CalendarIcon = svg('calendar');
export const MakeIcon = svg('make');
export const UpkeepIcon = svg('upkeep');
export const CampusIcon = svg('campus');
