"use client";

import { useToast } from "@/components/toast";

export function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="fld">
      <label htmlFor={id}>{label}</label>
      <div className="integ-copy">
        <input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast("Copied");
            } catch {
              toast("Couldn’t copy. Select the address and copy it by hand.");
            }
          }}
        >
          Copy
        </button>
      </div>
    </div>
  );
}
