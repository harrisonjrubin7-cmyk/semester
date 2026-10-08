"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Modal side drawer on the native <dialog>: focus is trapped, Escape closes, focus returns to the opener. */
export function Drawer({ open, onClose, title, subtitle, children, width = "max-w-3xl" }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-0 ml-auto h-dvh max-h-dvh w-full ${width} border-l border-line bg-surface p-0 shadow-2xl`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id="drawer-title" className="truncate text-lg font-semibold">{title}</h2>
              {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
            </div>
            <button type="button" onClick={onClose} className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-surface-2" aria-label="Close panel">
              Close
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
