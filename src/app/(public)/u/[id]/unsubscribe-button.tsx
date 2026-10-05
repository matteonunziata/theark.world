"use client";

import { useActionState } from "react";
import { unsubscribe } from "./actions";

export function UnsubscribeButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(unsubscribe, null as null | "ok" | "unknown");
  if (state === "ok") {
    return (
      <>
        <h2>You’re unsubscribed</h2>
        <p>You won’t get marketing emails from The ARK any more. Tickets and passes still come through.</p>
      </>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <h2>{state === "unknown" ? "We couldn’t find that link" : "Unsubscribe from The ARK’s emails?"}</h2>
      <p>
        {state === "unknown"
          ? "It may be from an old email. Reply to any email from us and we’ll take you off the list."
          : "You’ll stop getting news and invitations. Tickets and passes still come through."}
      </p>
      {state !== "unknown" && (
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "One moment…" : "Unsubscribe"}
        </button>
      )}
    </form>
  );
}
