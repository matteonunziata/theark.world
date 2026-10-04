"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { checkIn } from "@/app/(staff)/events/actions";

export function CheckInButton({ token, className = "btn primary" }: { token: string; className?: string }) {
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
          const r = await checkIn(token);
          toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
          router.refresh();
        })
      }
    >
      {pending ? "Checking in…" : "Check in"}
    </button>
  );
}

export function CopyTicketLink({ url }: { url: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn"
      onClick={() =>
        navigator.clipboard.writeText(url).then(
          () => toast("Link copied"),
          () => toast("Copy the address from your browser"),
        )
      }
    >
      Copy link
    </button>
  );
}
