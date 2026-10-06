"use client";

import { GateButton } from "@/components/gate-button";
import { useToast } from "@/components/toast";
import { checkIn } from "@/app/(staff)/events/actions";

export function CheckInButton({ token, className = "btn primary" }: { token: string; className?: string }) {
  return <GateButton token={token} action={checkIn} href={`/t/${token}?done=1`} className={className} />;
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
