"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { coverUrl } from "@/lib/covers";
import { createClient } from "@/lib/supabase/client";

/** Photo picker: shrinks the image in the browser, uploads it, and submits its path. */
export function CoverField({ name = "cover_path", initial }: { name?: string; initial?: string | null }) {
  const [cover, setCover] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function upload(file: File) {
    setBusy(true);
    try {
      const blob = await resizeImage(file, 1800);
      const path = `${crypto.randomUUID()}.jpg`;
      const { error } = await createClient()
        .storage.from("covers")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setCover(path);
    } catch {
      toast("Couldn’t upload that photo. Try a JPG or PNG under 10 MB.");
    }
    setBusy(false);
  }

  return (
    <div className="cover-ed">
      <input type="hidden" name={name} value={cover} />
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl(cover) ?? ""} alt="" />
      ) : (
        <div className="ph">No photo</div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label className="btn" style={{ cursor: "pointer" }}>
          {busy ? "Uploading…" : cover ? "Replace" : "Add photo"}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {cover && (
          <button type="button" className="btn ghost" onClick={() => setCover("")}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export async function resizeImage(file: File, max: number): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize"))), "image/jpeg", 0.85),
  );
}
