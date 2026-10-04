"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { logEntry } from "../actions";

export function LogEntryButton({ token, className = "btn primary" }: { token: string; className?: string }) {
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
          const r = await logEntry(token);
          toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
          router.refresh();
        })
      }
    >
      {pending ? "Logging…" : "Log entry"}
    </button>
  );
}
