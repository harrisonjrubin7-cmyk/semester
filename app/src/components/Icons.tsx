/**
 * Lucide-style icons, inline at stroke-width 1.5 — the Industry system's rule.
 * Inlined rather than pulled from a package so the whole set is one small file
 * and nothing ships that is not used.
 */

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function svg(path: React.ReactNode) {
  return function Icon({ size = 19, className, style }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ display: 'block', ...style }}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };
}

export const ChevronRight = svg(<path d="m9 18 6-6-6-6" />);
export const ChevronLeft = svg(<path d="m15 18-6-6 6-6" />);
export const Search = svg(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </>,
);
export const Bell = svg(
  <>
    <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M10.5 20a2 2 0 0 0 3 0" />
  </>,
);
export const Person = svg(
  <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
  </>,
);
export const Check = svg(<path d="M20 6 9 17l-5-5" />);
export const Plus = svg(<path d="M12 5v14M5 12h14" />);
export const TodayIcon = svg(
  <>
    <path d="M4 5.5h16v15H4z" />
    <path d="M8 2v3M16 2v3M3.5 9h17" />
    <path d="m8.5 14.5 2 2 4-4" />
  </>,
);
export const CoursesIcon = svg(
  <>
    <path d="M4 4.5h16v6H4zM4 13.5h16v6H4z" />
  </>,
);
export const StudyIcon = svg(
  <>
    <path d="M12 6.5C10.5 5.2 8.4 4.5 5 4.5v13c3.4 0 5.5.7 7 2 1.5-1.3 3.6-2 7-2v-13c-3.4 0-5.5.7-7 2z" />
    <path d="M12 6.5v15" />
  </>,
);
export const NotesIcon = svg(
  <>
    <path d="M5.5 3.5h13v17h-13z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </>,
);
export const PlayIcon = svg(<path d="M8 5.5v13l11-6.5z" />);
export const PauseIcon = svg(
  <>
    <path d="M9 5v14M15 5v14" />
  </>,
);
/** A folded map, not a pin — the tab is a map, and a pin is a saved place. */
export const MapIcon = svg(
  <>
    <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z" />
    <path d="M9 3v15" />
    <path d="M15 6v15" />
  </>,
);
export const CalendarIcon = svg(
  <>
    <path d="M4 5.5h16v15H4z" />
    <path d="M8 2v3M16 2v3M3.5 9h17" />
    <path d="M8 13h3v3H8z" />
  </>,
);

/*
 * The next three exist for the tab bar a student arranges themselves.
 *
 * Forty-two screens can go in that bar and fourteen of them have an icon of
 * their own. The rest borrow one of these — one per shelf in `lib/nav.ts` —
 * so a chosen tab shows which part of the app it came from rather than a
 * placeholder square. The label underneath still says which screen it is;
 * the glyph is only there to make the bar readable at a glance.
 */

/** Make — a pen nib. Everything on that shelf produces something. */
export const MakeIcon = svg(
  <>
    <path d="M4 20.5 5 16 16.5 4.5l3 3L8 19z" />
    <path d="m14.5 6.5 3 3" />
  </>,
);

/** Upkeep — sliders. The shelf you go to when something needs correcting. */
export const UpkeepIcon = svg(
  <>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <circle cx="9" cy="7" r="2" />
    <circle cx="15" cy="12" r="2" />
    <circle cx="8" cy="17" r="2" />
  </>,
);

/** Campus — a building with windows. */
export const CampusIcon = svg(
  <>
    <path d="M4 21V9l8-5 8 5v12" />
    <path d="M3 21h18" />
    <path d="M9 21v-5h6v5" />
    <path d="M9 11.5h2M13 11.5h2" />
  </>,
);
