"use client";

import {
  useActionState,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";

/**
 * The prototype's right-hand drawer, as a native <dialog>. The form inside
 * posts to a server action; on success the drawer closes and shows a toast.
 */
export function Drawer({
  title,
  open,
  onClose,
  action,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  action?: (prev: ActionResult, data: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [state, formAction, pending] = useActionState(
    action ?? (async () => ({ ok: true }) as ActionResult),
    { ok: false } as ActionResult,
  );

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const onSaved = useEffectEvent((message: string) => {
    toast(message);
    onClose();
  });
  useEffect(() => {
    if (state.ok && state.message) onSaved(state.message);
  }, [state]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="drawerTitle"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <form action={formAction}>
          <header>
            <h2 id="drawerTitle">{title}</h2>
            <button type="button" className="x" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </header>
          <div className="body">
            {!state.ok && state.error && (
              <div className="form-error" role="alert">
                {state.error}
              </div>
            )}
            {children}
          </div>
          {footer && (
            <footer>
              <fieldset disabled={pending} style={{ display: "contents" }}>
                {footer}
              </fieldset>
            </footer>
          )}
        </form>
      )}
    </dialog>
  );
}

/**
 * A delete button that asks for a second click, then submits the drawer's
 * form with intent=delete.
 */
export function ConfirmButton({ label = "Delete" }: { label?: string }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <button type="submit" name="intent" value="delete" className="btn danger armed">
      Confirm {label.toLowerCase()}
    </button>
  ) : (
    <button type="button" className="btn danger" onClick={() => setArmed(true)}>
      {label}
    </button>
  );
}

/** Opens a drawer for one item (or a new one) and remembers which. */
export function useDrawer<T>() {
  const [item, setItem] = useState<T | null | undefined>(undefined);
  return {
    open: item !== undefined,
    item: item ?? null,
    openNew: () => setItem(null),
    openItem: (i: T) => setItem(i),
    close: () => setItem(undefined),
  };
}
