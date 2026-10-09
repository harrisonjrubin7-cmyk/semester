import type { HTMLAttributes, PropsWithChildren } from 'react';

export interface SemesterDesignSurfaceProps
  extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  /** A short, human-readable label for this component region. */
  label?: string;
}

/**
 * Contains the imported archive component vocabulary.
 *
 * The class is an intentional compatibility boundary: archive selectors are
 * scoped to descendants of this element and their role tokens resolve to the
 * current production semantic tokens. It is not a second application shell.
 */
export function SemesterDesignSurface({
  children,
  className,
  label,
  ...rest
}: SemesterDesignSurfaceProps) {
  return (
    <div
      {...rest}
      className={['semester-design-components', className].filter(Boolean).join(' ')}
      aria-label={label}
      data-semester-design="archive-2026-10-08"
    >
      {children}
    </div>
  );
}
