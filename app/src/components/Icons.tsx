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
export const AppsIcon = svg('apps');
export const TodayIcon = svg('today');
export const CoursesIcon = svg('courses');
export const StudyIcon = svg('study');
export const NotesIcon = svg('notes');
export const FolderIcon = svg('folder');
export const Paperclip = svg('paperclip');

/**
 * The one icon that carries a state.
 *
 * Filled when it is a favourite and outlined when it is not, from the same
 * path — an outline glyph and a solid glyph would be two shapes to keep in
 * step, and the moment they drift the filled one is a different star.
 */
export function StarIcon({ on = false, size = 19, className, style }: IconProps & { on?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={STROKE.viewBox}
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={STROKE.width}
      strokeLinecap={STROKE.cap}
      strokeLinejoin={STROKE.join}
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      {SHAPES.star.map(draw)}
    </svg>
  );
}
export const MapIcon = svg('map');
export const CalendarIcon = svg('calendar');
export const MakeIcon = svg('make');
export const UpkeepIcon = svg('upkeep');
export const CampusIcon = svg('campus');

/* The tools, one each — see the note beside their shapes in `icons.data.ts`. */
export const AskIcon = svg('ask');
export const WorkIcon = svg('work');
export const UpdateIcon = svg('update');
export const AnalyseIcon = svg('analyse');
export const DrawIcon = svg('draw');
export const SolveIcon = svg('solve');
export const ExamIcon = svg('exam');
export const DeckIcon = svg('deck');
export const WriteIcon = svg('write');
export const SheetIcon = svg('sheet');
export const EquationsIcon = svg('equations');
export const SourcesIcon = svg('sources');
export const EssayIcon = svg('essay');
export const RunwayIcon = svg('runway');
export const MailIcon = svg('mail');
export const ProofIcon = svg('proof');

/* The twenty-seven drawn for the launcher — see the note in `icons.data.ts`. */
export const BriefIcon = svg('brief');
export const AheadIcon = svg('ahead');
export const BehindIcon = svg('behind');
export const TonightIcon = svg('tonight');
export const DegreeIcon = svg('degree');
export const ImportIcon = svg('import');
export const EditIcon = svg('edit');
export const RegistrarIcon = svg('registrar');
export const AnnounceIcon = svg('announce');
export const MeetIcon = svg('meet');
export const GroupworkIcon = svg('groupwork');
export const MealsIcon = svg('meals');
export const HousingIcon = svg('housing');
export const YesIcon = svg('yes');
export const ClassmatesIcon = svg('classmates');
export const CostsIcon = svg('costs');
export const PeopleIcon = svg('people');
export const ApplyingIcon = svg('applying');
export const ClocksIcon = svg('clocks');
export const LinksIcon = svg('links');
export const AccountIcon = svg('account');
export const ConnectIcon = svg('connect');
export const DataIcon = svg('data');
export const PrivacyIcon = svg('privacy');
export const ExportIcon = svg('export');
export const SettingsIcon = svg('settings');
export const ActivitiesIcon = svg('activities');
export const HelpIcon = svg('help');
/** You, ringed. `Person` is anybody; this one is the reader. */
export const ProfileIcon = svg('profile');
