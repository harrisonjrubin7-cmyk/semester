import { useRef, useState, type ReactNode } from 'react';
import { Popover, type Corner } from '../Popover';

/** Shared tools use the existing viewport-safe menu shell, not the clipped pane. */
export function ToolDisclosure({ label, trigger, className, width, lazy = false, children }: {
  label: string;
  trigger: ReactNode;
  className: string;
  width: number;
  lazy?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(!lazy);
  const [corner, setCorner] = useState<Corner>({x: 8, y: 8});
  const close = () => {
    if (details.current) details.current.open = false;
    setOpen(false);
  };
  return <>
    <details className={className} ref={details} onToggle={event => {
      const isOpen = event.currentTarget.open;
      if (isOpen) {
        const rect = event.currentTarget.querySelector('summary')!.getBoundingClientRect();
        setCorner({x: rect.left, y: rect.bottom + 8});
        setLoaded(true);
      }
      setOpen(isOpen);
    }}>
      <summary className="system-tool-trigger tap-y" aria-label={label}>{trigger}</summary>
    </details>
    {loaded && <Popover label={label} corner={corner} width={width} open={open} onClose={close} anchor={details} className="system-tool-popover">
      <div className="system-tool-close"><button type="button" className="bare tap" aria-label={`Close ${label}`} onClick={close}>✕</button></div>
      <div className="system-tool-content">{typeof children === 'function' ? children(close) : children}</div>
    </Popover>}
  </>;
}
