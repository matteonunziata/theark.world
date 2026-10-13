"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { cancelBooking } from "../../actions";

export function CancelBooking({ id, title, paid }: { id: string; title: string; paid: boolean }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="pv-btn ghost sm"
      disabled={busy}
      onClick={() =>
        confirm(
          paid
            ? `Cancel your booking for ${title}? You paid for it, so the team will follow up about a refund.`
            : `Cancel your booking for ${title}?`,
        ) &&
        start(async () => {
          const r = await cancelBooking(id);
          toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
        })
      }
    >
      {busy ? "Cancelling…" : "Cancel"}
    </button>
  );
}
