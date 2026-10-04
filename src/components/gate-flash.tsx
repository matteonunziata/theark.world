"use client";

import { useEffect, useState } from "react";

/**
 * What security sees the moment they scan a code: the whole screen goes
 * green when it's good to let the person in, red otherwise. Tap to dismiss.
 */
export function GateFlash({
  ok,
  title,
  detail,
  action,
}: {
  ok: boolean;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    navigator.vibrate?.(ok ? 80 : [120, 80, 120]);
  }, [ok]);
  if (!open) return null;
  return (
    <div
      className={`gate-flash ${ok ? "ok" : "no"}`}
      role="alertdialog"
      aria-live="assertive"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="gf-mark" aria-hidden="true">{ok ? "✓" : "✕"}</div>
      <h1>{title}</h1>
      {detail && <p>{detail}</p>}
      <div className="gf-acts">
        {action}
        <button type="button" className="gf-close" onClick={() => setOpen(false)}>
          {ok ? "See details" : "Close"}
        </button>
      </div>
    </div>
  );
}
