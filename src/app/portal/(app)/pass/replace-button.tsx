"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { replaceMyPass } from "../../actions";

/** For a lost phone or a shared screenshot: a new code, the old one dead. */
export function ReplacePassButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      className="pv-btn ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm("Get a new pass code? The old one stops working at once, including any saved image.")) return;
        start(async () => {
          const r = await replaceMyPass();
          toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
          router.refresh();
        });
      }}
    >
      {pending ? "Making a new code…" : "Get a new code"}
    </button>
  );
}
