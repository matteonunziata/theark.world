"use client";

import { useState } from "react";
import { initials } from "@/components/avatar";
import { resizeImage } from "@/components/cover-field";
import { useToast } from "@/components/toast";
import { avatarUrl } from "@/lib/covers";
import { createClient } from "@/lib/supabase/client";
import { setPhoto } from "../../actions";

/** Members add a photo so facilitators can greet them by name at the door. */
export function PhotoField({ name, initial }: { name: string; initial: string | null }) {
  const [path, setPath] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const src = avatarUrl(path);

  async function upload(file: File) {
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("signed out");
      const blob = await resizeImage(file, 600);
      const next = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(next, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const res = await setPhoto(next);
      if (!res.ok) throw new Error(res.error);
      if (path) await supabase.storage.from("avatars").remove([path]);
      setPath(next);
      toast("Photo saved");
    } catch {
      toast("Couldn’t upload that photo. Try a JPG or PNG under 10 MB.");
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const res = await setPhoto(null);
    if (res.ok && path) await createClient().storage.from("avatars").remove([path]);
    if (res.ok) setPath(null);
    toast(res.ok ? "Photo removed" : (res.error ?? "Couldn’t remove it."));
    setBusy(false);
  }

  return (
    <div className="pv-photo">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
      <div>
        <b>Your photo</b>
        <p>Helps facilitators and the team welcome you by name.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="pv-btn sm" style={{ cursor: "pointer" }}>
            {busy ? "Saving…" : src ? "Change photo" : "Add a photo"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          {src && (
            <button type="button" className="pv-btn ghost sm" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
