import { ProfileIcon } from './Icons';
import { initials } from '../lib/profile';

/**
 * The little picture of you, in the two sizes the app needs it.
 *
 * One component rather than one in the header and one on the profile screen,
 * because the two would drift on the thing that matters most about an avatar:
 * whether the letters in it are the same letters. They come from
 * `lib/profile.ts`, which is where the rule lives that neither of them may
 * break — a name is asked for, never derived from an email address.
 *
 * ## The two states, and why the empty one is a glyph
 *
 * With a name, the initials in a tinted box. With none, the ringed figure from
 * `icons.data.ts` and no box at all: the box is a container for letters, and an
 * empty one beside four icon buttons reads as a button inside a button. The
 * glyph is also what says the screen is still worth opening — it is the control
 * that asks for the name.
 *
 * ## Why it is not a circle
 *
 * Every other app's is, and this one follows the reader's `corners` setting
 * instead — square on the Industry grounds, rounded on the soft ones. A
 * hard-coded `999px` would make the avatar the one round thing on a screen of
 * right angles, which is what "borrowed from somewhere else" looks like. See
 * `lib/look.ts`; `--r-lg` is the same token every panel in the app uses. The
 * glyph carries the ring that says "this is you" either way.
 *
 * ## No photograph
 *
 * There is nowhere to put one. An image means bytes in the same quota that
 * already sheds data when it fills — see `screens/Data.tsx` — and an upload
 * means a server, which is the promise this app does not make. Initials cost
 * nothing and say the same thing.
 */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letters = initials(name);
  if (letters === '') return <ProfileIcon size={size} />;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--r-lg)',
        background: 'var(--app-accent-wash)',
        border: '1px solid var(--app-accent-deep)',
        color: 'var(--app-accent)',
        // Computed from the box rather than written as a size, on purpose: the
        // letters fill whatever square they are given, and the square is
        // already whatever the caller asked for. See `styles/rules.ts` — a size
        // computed from a measurement is not a literal for the type scale to
        // reach, because the measurement is what it answers to instead.
        fontSize: Math.round(size * 0.4),
        fontFamily: 'var(--font-heading)',
        letterSpacing: '0.04em',
        lineHeight: 1,
        overflow: 'hidden',
      }}
    >
      {letters}
    </span>
  );
}
