"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/drawer";
import { tierName } from "@/lib/crm";
import { createClient } from "@/lib/supabase/client";
import { addMember } from "./actions";

type Found = { id: string; name: string; email: string | null; tier: string | null; membership_status: string; photo_path: string | null };
type Tier = { key: string; name: string };

/** "Add new member": find an existing contact (the team included) or create one, add their photo and give them a tier. */
export function AddMember({ tiers }: { tiers: Tier[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        Add new member
      </button>
      <Drawer
        title="Add new member"
        open={open}
        onClose={() => setOpen(false)}
        action={addMember}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Add member</button>
          </>
        }
      >
        <Body tiers={tiers} />
      </Drawer>
    </>
  );
}

function Body({ tiers }: { tiers: Tier[] }) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [photoState, setPhotoState] = useState<"idle" | "uploading" | "error">("idle");

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoState("uploading");
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `contacts/${crypto.randomUUID()}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("avatars").upload(path, file, { contentType: file.type || undefined });
    if (error) {
      setPhotoState("error");
      return;
    }
    setPhoto({ path, preview: URL.createObjectURL(file) });
    setPhotoState("idle");
  }
  const needsPhoto = mode === "new" || (picked && !picked.photo_path);

  useEffect(() => {
    // Characters that mean something in a PostgREST filter or an ILIKE.
    const term = q.replace(/[%,()*\\]/g, " ").trim();
    if (picked || term.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("contacts")
        .select("id, name, email, tier, membership_status, photo_path")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
        .order("name")
        .limit(10);
      if (live) setMatches((data as Found[] | null) ?? []);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, picked]);

  const results = !picked && q.trim().length >= 2 ? matches : [];
  return (
    <>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="photo_path" value={photo?.path ?? ""} />
      <div className="tabs" role="tablist" aria-label="Who">
        <button type="button" role="tab" aria-selected={mode === "existing"} className={mode === "existing" ? "on" : ""} onClick={() => setMode("existing")}>
          Existing contact
        </button>
        <button type="button" role="tab" aria-selected={mode === "new"} className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>
          New person
        </button>
      </div>
      {mode === "new" ? (
        <>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="am-first">First name</label>
              <input id="am-first" name="first_name" required autoComplete="off" />
            </div>
            <div className="fld">
              <label htmlFor="am-last">Last name</label>
              <input id="am-last" name="last_name" autoComplete="off" />
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="am-phone">Phone</label>
              <input id="am-phone" name="phone" type="tel" autoComplete="off" />
            </div>
            <div className="fld">
              <label htmlFor="am-email">Email</label>
              <input id="am-email" name="email" type="email" autoComplete="off" />
            </div>
          </div>
        </>
      ) : (
      <div className="fld">
        <input type="hidden" name="contact_id" value={picked?.id ?? ""} />
        <label htmlFor="am-q">Person</label>
        {picked ? (
          <div className="pick-chip" style={{ marginBottom: 0 }}>
            <b>
              {picked.name}
              {picked.tier && picked.membership_status === "active" ? `, now ${tierName(picked.tier)}` : ""}
            </b>
            <button type="button" className="linkish-sm" onClick={() => { setPicked(null); setQ(""); setMatches([]); }}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              id="am-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contacts and team by name, email or phone"
              autoComplete="off"
              autoFocus
            />
            {results.length > 0 && (
              <div className="pick-list" role="listbox" aria-label="Matching people">
                {results.map((m) => (
                  <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => setPicked(m)}>
                    <b>{m.name}</b>
                    <span className="muted">
                      {[m.email || "No email", m.tier && m.membership_status === "active" ? tierName(m.tier) : null]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && !results.length && (
              <span className="hint">
                No one found.{" "}
                <button type="button" className="linkish-sm" onClick={() => setMode("new")}>Add them as a new person</button>
              </span>
            )}
          </>
        )}
      </div>
      )}
      {needsPhoto && (
        <div className="fld">
          <label htmlFor="am-photo">Photo</label>
          <input id="am-photo" type="file" accept="image/*" capture="user" onChange={(e) => onPhoto(e.target.files?.[0])} />
          {photo && (
            // biome-ignore lint/performance/noImgElement: local preview of the chosen file
            <img src={photo.preview} alt="Chosen photo" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, marginTop: 8 }} />
          )}
          <span className="hint">
            {photoState === "uploading"
              ? "Uploading…"
              : photoState === "error"
                ? "Couldn’t upload that photo. Try again."
                : "Every pass needs a photo of the person."}
          </span>
        </div>
      )}
      <div className="fld">
        <label htmlFor="am-tier">Tier</label>
        <select id="am-tier" name="tier" required defaultValue="">
          <option value="" disabled>Choose a tier</option>
          {tiers.map((t) => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="am-from">Starts</label>
          <input id="am-from" name="starts" type="date" />
          <span className="hint">Leave empty for today.</span>
        </div>
        <div className="fld">
          <label htmlFor="am-to">Ends</label>
          <input id="am-to" name="ends" type="date" />
          <span className="hint">Leave empty for no end.</span>
        </div>
      </div>
    </>
  );
}
