"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { setFinanceCurrency } from "./actions";

const OPTIONS = [
  ["CRC", "₡ CRC"],
  ["USD", "$ USD"],
] as const;

export function CurrencyToggle({ value, note }: { value: string; note: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const pick = (cur: string) =>
    start(async () => {
      const r = await setFinanceCurrency(cur);
      if (!r.ok) toast(r.error ?? "");
    });
  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
      <div className="seg" style={{ marginBottom: 0 }} role="group" aria-label="Currency">
        {OPTIONS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={value === k ? "on" : ""}
            aria-pressed={value === k}
            disabled={pending}
            onClick={() => value !== k && pick(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <small className="muted">{note}</small>
    </div>
  );
}
