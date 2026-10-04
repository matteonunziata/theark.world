"use client";

import { useEffect, useState } from "react";

/**
 * What security sees after scanning a code: the whole screen, green with a
 * checkmark when the person can come in, red otherwise. Nothing else to read.
 * Tap anywhere to see the details underneath.
 */
export function ScanResult({ ok, title, name, detail }: { ok: boolean; title: string; name?: string; detail?: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    navigator.vibrate?.(ok ? 80 : [120, 80, 120]);
  }, [ok]);
  if (!open) return null;
  return (
    <button
      type="button"
      className={`scan ${ok ? "ok" : "no"}`}
      aria-live="assertive"
      onClick={() => setOpen(false)}
    >
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
      <span className="scan-tap">Tap for details</span>
    </button>
  );
}
