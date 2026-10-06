"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";

/**
 * The gate's Check in button. Runs the server action for this kind of code,
 * then reopens the page with ?done=1 so the screen turns into "Checked in"
 * rather than "Already checked in".
 */
export function GateButton({
  token,
  action,
  href,
  label = "Check in",
  className = "btn primary",
}: {
  token: string;
  action: (token: string) => Promise<ActionResult>;
  /** Where to go after a successful check-in. */
  href: string;
  label?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await action(token);
          if (r.ok) {
            router.replace(href);
          } else {
            toast(r.error ?? "");
            router.refresh();
          }
        })
      }
    >
      {pending ? "Checking in…" : label}
    </button>
  );
}
