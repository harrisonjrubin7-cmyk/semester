import { useId, useState, type ReactNode } from 'react';
import { Popover, type Corner } from '../Popover';

/** Shared tools use the existing viewport-safe menu shell, not the clipped pane. */
export function ToolDisclosure({ label, triggerLabel = label, trigger, className, width, lazy = false, children }: {
  label: string;
  triggerLabel?: string;
  trigger: ReactNode;
  className: string;
  width: number;
  lazy?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const panelId = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(!lazy);
  const [corner, setCorner] = useState<Corner>({x: 8, y: 8});
  const close = () => setOpen(false);
  const toggle = () => {
    if (!open && anchor) {
      const rect = anchor.getBoundingClientRect();
      setCorner({x: rect.left, y: rect.bottom + 8});
      setLoaded(true);
    }
    setOpen(value => !value);
  };
  return <>
    <div className={className} data-open={open || undefined}>
      {/* A lazy panel does not exist until its first opening. Expose the
          relationship only once there is a real target, then keep it stable
          while the mounted panel is closed. */}
      <button
        ref={setAnchor}
        type="button"
        className="bare system-tool-trigger tap-y"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={loaded ? panelId : undefined}
        onClick={toggle}
      >
        {trigger}
      </button>
    </div>
    {loaded && <Popover id={panelId} label={label} corner={corner} width={width} open={open} onClose={close} anchor={anchor} className="system-tool-popover">
      <div className="system-tool-close"><button type="button" className="bare tap" aria-label={`Close ${label}`} onClick={close}>✕</button></div>
      <div className="system-tool-content">{typeof children === 'function' ? children(close) : children}</div>
    </Popover>}
  </>;
}
