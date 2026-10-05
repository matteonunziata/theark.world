"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";

const publicUrl = (bucket: string, path: string) =>
  path.startsWith("/") || path.startsWith("https://")
    ? path
    : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

/**
 * Photo picker: shrinks the image in the browser, uploads it to a public
 * bucket, and submits its path. A photo hosted elsewhere (`initialUrl`) shows
 * until it's replaced; `keepName` submits "1" while that photo is kept.
 */
export function CoverField({
  name = "cover_path",
  initial,
  bucket = "covers",
  initialUrl,
  keepName,
}: {
  name?: string;
  initial?: string | null;
  bucket?: string;
  initialUrl?: string | null;
  keepName?: string;
}) {
  const [cover, setCover] = useState(initial ?? "");
  const [external, setExternal] = useState(initialUrl ?? "");
  const src = cover ? publicUrl(bucket, cover) : external;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function upload(file: File) {
    setBusy(true);
    try {
      const blob = await resizeImage(file, 1800);
      const path = `${crypto.randomUUID()}.jpg`;
      const { error } = await createClient()
        .storage.from(bucket)
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
      {keepName && <input type="hidden" name={keepName} value={external ? "1" : ""} />}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <div className="ph">No photo</div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label className="btn" style={{ cursor: "pointer" }}>
          {busy ? "Uploading…" : src ? "Replace" : "Add photo"}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {src && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setCover("");
              setExternal("");
            }}
          >
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
