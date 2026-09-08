import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useGrouped } from './shell/useShell';

/**
 * The props a caller may pass straight through to the element.
 *
 * Deliberately not "every prop": `className`, `style` and `onClick` are the
 * frame's own and are composed rather than replaced. `HTMLAttributes` rather
 * than the button's own, because both branches below spread it and a
 * `disabled` that silently vanished on the `div` would be worse than one the
 * type refuses.
 */
type Passed = Omit<HTMLAttributes<HTMLElement>, 'className' | 'style' | 'onClick' | 'children'>;

/**
 * The wireframe frame every card, figure and primary object wears in the
 * Industry system: square corners, a hairline border, and four `+` registration
 * marks. The marks are not decoration — the system's rule is that a framed
 * element never drops them.
 */
export function Blueprint({
  children,
  style,
  className,
  onClick,
  as = 'div',
  plain = false,
  ...rest
}: Passed & {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
  as?: 'div' | 'button';
  /**
   * Drop the registration marks.
   *
   * The marks say "this is a framed object", which is true of a hero card and
   * false of the fourth row in a list. Ten stacked cards put forty little
   * crosses on the screen, they collide across the gaps between rows, and what
   * was a signature becomes texture you have to read past. Feature cards keep
   * them; repeated rows set this.
   */
  plain?: boolean;
}) {
  /*
   * The grouped layout drops the registration marks.
   *
   * The Industry system's rule, stated four lines above, is that a framed
   * element never drops them — and that rule is right for the layout it was
   * written for. An inset panel with crosses in its corners is neither thing.
   * This is the one deliberate departure from it, it lives in one mode, and
   * the drawn layout keeps every mark exactly where it was.
   */
  const grouped = useGrouped();
  const marks = plain || grouped ? null : (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );

  if (as === 'button' || onClick) {
    return (
      <button
        {...rest}
        type="button"
        onClick={onClick}
        className={`blueprint bare tappable${grouped ? ' grouped' : ''}${className ? ` ${className}` : ''}`}
        style={style}
      >
        {marks}
        {children}
      </button>
    );
  }

  return (
    <div
      {...rest}
      className={`blueprint${grouped ? ' grouped' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {marks}
      {children}
    </div>
  );
}
