"use client";

import { useState } from "react";
import { assetUrl } from "@/lib/marketing";

export type AssetLite = { id: string; title: string; kind: string; path: string | null; brands: string[] };

/** Pick assets from the library; submits each chosen id as `name`. */
export function AssetPicker({
  assets,
  selected,
  name = "asset_ids",
  label = "Attached assets",
}: {
  assets: AssetLite[];
  selected: string[];
  name?: string;
  label?: string;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = picked.map((id) => assets.find((a) => a.id === id)).filter((a): a is AssetLite => !!a);
  const matches = assets.filter((a) => !q.trim() || a.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="fld">
      <span className="lbl" style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
      {picked.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {chosen.length > 0 && (
        <div className="asset-chips">
          {chosen.map((a) => (
            <span key={a.id} className="asset-chip">
              <Thumb a={a} />
              <span>{a.title}</span>
              <button type="button" aria-label={`Remove ${a.title}`} onClick={() => toggle(a.id)}>×</button>
            </span>
          ))}
        </div>
      )}
      {open ? (
        <div className="asset-pick">
          <input type="search" placeholder="Search the library" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search assets" />
          <div className="asset-pick-grid">
            {matches.map((a) => (
              <button key={a.id} type="button" className={picked.includes(a.id) ? "on" : ""} aria-pressed={picked.includes(a.id)} onClick={() => toggle(a.id)}>
                <Thumb a={a} />
                <span>{a.title}</span>
              </button>
            ))}
            {!matches.length && <p className="muted">Nothing matches. Add files in the asset library.</p>}
          </div>
          <button type="button" className="linkish-sm" onClick={() => setOpen(false)}>Done</button>
        </div>
      ) : (
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
          {chosen.length ? "Change assets" : "Attach from library"}
        </button>
      )}
    </div>
  );
}

export function Thumb({ a }: { a: { kind: string; path: string | null; title: string } }) {
  const src = assetUrl(a.path);
  if (a.kind === "photo" && src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="thumb" src={src} alt="" loading="lazy" />;
  }
  return <span className={`thumb kind-${a.kind}`}>{a.kind === "video" ? "Video" : a.kind === "copy" ? "Copy" : "File"}</span>;
}
