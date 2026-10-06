"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * What security sees after scanning a code: the whole screen, green when the
 * person can come in, red otherwise, with one line saying why. Nothing else
 * to read. The Check in button sits inside it; "Details" closes it.
 */
export function ScanResult({
  ok,
  title,
  name,
  detail,
  action,
}: {
  ok: boolean;
  title: string;
  name?: string;
  detail?: string;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    navigator.vibrate?.(ok ? 80 : [120, 80, 120]);
  }, [ok]);
  if (!open) return null;
  return (
    <div className={`scan ${ok ? "ok" : "no"}`} role="status" aria-live="assertive">
      <span className="scan-mark" aria-hidden="true">
        {ok ? (
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        ) : (
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        )}
      </span>
      <span className="scan-title">{title}</span>
      {name && <span className="scan-name">{name}</span>}
      {detail && <span className="scan-detail">{detail}</span>}
      {action && <div className="scan-act">{action}</div>}
      <button type="button" className="scan-tap" onClick={() => setOpen(false)}>
        Details
      </button>
    </div>
  );
}
