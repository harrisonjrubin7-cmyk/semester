import type { CSSProperties, ReactNode } from 'react';

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
}: {
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
  const marks = plain ? null : (
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
        type="button"
        onClick={onClick}
        className={`blueprint bare tappable${className ? ` ${className}` : ''}`}
        style={style}
      >
        {marks}
        {children}
      </button>
    );
  }

  return (
    <div className={`blueprint${className ? ` ${className}` : ''}`} style={style}>
      {marks}
      {children}
    </div>
  );
}
