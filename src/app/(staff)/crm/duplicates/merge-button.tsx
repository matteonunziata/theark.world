"use client";

import { useState, useTransition } from "react";
import { mergeContacts } from "./actions";

/** Merge the other contact into this one. Asks first, because it can't be undone. */
export function MergeButton({ keepId, dropId, keepName, dropName }: { keepId: string; dropId: string; keepName: string; dropName: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn ghost"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Keep ${keepName} and merge the other record (${dropName}) into it? This can't be undone.`)) return;
          setError(null);
          start(async () => {
            const r = await mergeContacts(keepId, dropId);
            if (!r.ok) setError(r.error ?? "Couldn’t merge.");
          });
        }}
      >
        {pending ? "Merging…" : "Keep this one"}
      </button>
      {error && <span className="muted" role="alert"> {error}</span>}
    </>
  );
}
