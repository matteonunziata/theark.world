"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";

/**
 * Saves a pass image to the phone. On iPhone and Android this opens the
 * share sheet, where "Save Image" puts it in Photos. Elsewhere it downloads.
 */
export function SaveImageButton({
  href,
  filename,
  label = "Save to Photos",
  className = "btn",
}: {
  href: string;
  filename: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename.replace(/\.png$/, "") });
        } catch (e) {
          if ((e as Error).name !== "AbortError") throw e;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast("Saved to your downloads");
      }
    } catch {
      toast("Couldn’t save the image. Take a screenshot instead.");
    }
    setBusy(false);
  }

  return (
    <button type="button" className={className} onClick={save} disabled={busy}>
      {busy ? "Preparing…" : label}
    </button>
  );
}
