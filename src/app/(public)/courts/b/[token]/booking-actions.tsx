"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelCourt } from "../../actions";

/** Cancel / leave, and copy the join link for an open match. */
export function BookingActions({
  token,
  host,
  joinUrl,
  copyOnly = false,
}: {
  token: string;
  host: boolean;
  joinUrl: string | null;
  copyOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <>
      {joinUrl && (
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(joinUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              window.prompt("Copy this link", joinUrl);
            }
          }}
        >
          {copied ? "Copied" : "Copy join link"}
        </button>
      )}
      {!copyOnly && (
        <button
          type="button"
          className="btn quiet"
          disabled={pending}
          onClick={() => {
            if (!confirm(host ? "Cancel this booking?" : "Leave this match?")) return;
            start(async () => {
              const r = await cancelCourt(token);
              if (!r.ok) setError(r.error ?? "Couldn’t cancel.");
              else router.refresh();
            });
          }}
        >
          {pending ? "One moment…" : host ? "Cancel booking" : "Leave the match"}
        </button>
      )}
      {error && (
        <span className="muted" role="alert" style={{ fontSize: 13.5, alignSelf: "center" }}>
          {error}
        </span>
      )}
    </>
  );
}
