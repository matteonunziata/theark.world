"use client";

import { useState } from "react";
import { resizeImage } from "@/components/cover-field";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";

/**
 * Upload a receipt, invoice or payment receipt (photo or PDF) to the private
 * `budgets` bucket, under the sector's own folder: {sector}/{budget}/{kind}/….
 * The form gets two hidden fields: `<name>_path` and `<name>_name`.
 */
export function FileField({
  name,
  folder,
  label,
  required,
}: {
  name: string;
  folder: string;
  label: string;
  required?: boolean;
}) {
  const [path, setPath] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast("That file is over 10 MB. Try a smaller photo or PDF.");
      return;
    }
    setBusy(true);
    try {
      const isImage = file.type.startsWith("image/");
      const body = isImage ? await resizeImage(file, 2200) : file;
      const ext = isImage ? "jpg" : (file.name.split(".").pop() ?? "pdf").toLowerCase();
      const p = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from("budgets")
        .upload(p, body, { contentType: isImage ? "image/jpeg" : file.type || "application/pdf" });
      if (error) throw error;
      setPath(p);
      setFileName(file.name);
    } catch {
      toast("Couldn’t upload that file. Try a photo or PDF under 10 MB.");
    }
    setBusy(false);
  }

  return (
    <div className="fld">
      <label>
        {label}
        {required ? " (required)" : ""}
      </label>
      <input type="hidden" name={`${name}_path`} value={path} />
      <input type="hidden" name={`${name}_name`} value={fileName} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {path && <span className="muted" style={{ fontSize: 13 }}>{fileName}</span>}
        <label className="btn" style={{ cursor: "pointer" }}>
          {busy ? "Uploading…" : path ? "Replace file" : "Take a photo or choose a file"}
          <input
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(ev) => ev.target.files?.[0] && upload(ev.target.files[0])}
          />
        </label>
        {path && (
          <button type="button" className="btn ghost" onClick={() => { setPath(""); setFileName(""); }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/** Files are private; open or download them through a link that expires in a minute. */
export async function openBudgetFile(path: string, download?: string | null) {
  const w = download ? null : window.open("", "_blank");
  const { data } = await createClient()
    .storage.from("budgets")
    .createSignedUrl(path, 60, download ? { download } : undefined);
  if (!data?.signedUrl) {
    w?.close();
    return;
  }
  if (w) w.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
