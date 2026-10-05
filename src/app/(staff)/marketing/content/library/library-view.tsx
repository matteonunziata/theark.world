"use client";

import { useState } from "react";
import { resizeImage } from "@/components/cover-field";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { ASSET_KINDS, assetUrl, type BrandKey, fmtCr } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/client";
import { saveAsset } from "../../actions";
import { BrandPicker, BrandTags } from "../../nav";
import { Thumb } from "../asset-picker";

type Asset = Tables<"marketing_assets"> & { uses: number };
const MAX_MB = 50;

export function LibraryView({ assets, brand }: { assets: Asset[]; brand: BrandKey | null }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const drawer = useDrawer<Asset>();
  const needle = q.trim().toLowerCase();
  const shown = assets.filter(
    (a) =>
      (!kind || a.kind === kind) &&
      (!needle ||
        a.title.toLowerCase().includes(needle) ||
        a.tags.some((t) => t.includes(needle)) ||
        (a.body ?? "").toLowerCase().includes(needle)),
  );

  return (
    <>
      <div className="mk-toolbar">
        <input
          type="search"
          className="mk-search"
          placeholder="Search titles, tags and copy"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the library"
        />
        <div className="pill-row" role="group" aria-label="Type" style={{ margin: 0 }}>
          <button type="button" className="pill" aria-pressed={!kind} onClick={() => setKind("")}>All</button>
          {ASSET_KINDS.map(([k, n]) => (
            <button key={k} type="button" className="pill" aria-pressed={kind === k} onClick={() => setKind(kind === k ? "" : k)}>
              {n}
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={drawer.openNew}>Add to library</button>
      </div>

      {shown.length ? (
        <div className="asset-grid">
          {shown.map((a) => (
            <button key={a.id} type="button" className="asset-card" onClick={() => drawer.openItem(a)}>
              {a.kind === "copy" ? (
                <span className="copy-prev">{a.body}</span>
              ) : (
                <Thumb a={a} />
              )}
              <span className="meta">
                <b>{a.title}</b>
                <BrandTags brands={a.brands} />
                {a.tags.length > 0 && <span className="tags-sm">{a.tags.map((t) => `#${t}`).join(" ")}</span>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>{assets.length ? "Nothing matches" : "The library is empty"}</h2>
          <p>{assets.length ? "Try another word, or clear the filters." : "Add photos, video and copy so the team can find them later."}</p>
        </div>
      )}

      <AssetDrawer key={drawer.item?.id ?? "new"} open={drawer.open} asset={drawer.item} brand={brand} onClose={drawer.close} />
    </>
  );
}

function AssetDrawer({
  open,
  asset,
  brand,
  onClose,
}: {
  open: boolean;
  asset: Asset | null;
  brand: BrandKey | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState(asset?.kind ?? "photo");
  const [path, setPath] = useState(asset?.path ?? "");
  const [title, setTitle] = useState(asset?.title ?? "");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const isVideo = file.type.startsWith("video/");
    if (file.size > MAX_MB * 1024 * 1024 && isVideo) {
      toast(`Videos can be up to ${MAX_MB} MB. Export a smaller version, or link the full file in the notes.`);
      return;
    }
    setBusy(true);
    try {
      const body = isVideo ? file : await resizeImage(file, 2400);
      const ext = isVideo ? (file.name.split(".").pop() ?? "mp4").toLowerCase() : "jpg";
      const p = `library/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from("marketing")
        .upload(p, body, { contentType: isVideo ? file.type : "image/jpeg" });
      if (error) throw error;
      setPath(p);
      setKind(isVideo ? "video" : "photo");
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    } catch {
      toast("Couldn’t upload that file. Try again, or a smaller file.");
    }
    setBusy(false);
  }

  const url = assetUrl(path);
  return (
    <Drawer
      title={asset ? "Asset" : "Add to the library"}
      open={open}
      onClose={onClose}
      action={saveAsset}
      footer={
        <>
          {asset && <ConfirmButton />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{asset ? "Save" : "Add"}</button>
        </>
      }
    >
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <input type="hidden" name="path" value={path} />
      <div className="fld">
        <label htmlFor="a-kind">Type</label>
        <select id="a-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {ASSET_KINDS.map(([k, n]) => (
            <option key={k} value={k}>{n}</option>
          ))}
        </select>
      </div>
      {kind !== "copy" && (
        <div className="fld">
          <span className="lbl" style={{ fontSize: 13.5, fontWeight: 600 }}>File</span>
          {url &&
            (kind === "video" ? (
              <video className="asset-prev" src={url} controls preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="asset-prev" src={url} alt="" />
            ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="btn" style={{ cursor: "pointer" }}>
              {busy ? "Uploading…" : url ? "Replace file" : kind === "video" ? "Upload video" : "Upload photo"}
              <input type="file" accept={kind === "video" ? "video/*" : "image/*"} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {url && (
              <a className="btn ghost" href={url} target="_blank" rel="noopener noreferrer" download>
                Download
              </a>
            )}
          </div>
          {kind === "video" && <span className="hint">Up to {MAX_MB} MB.</span>}
        </div>
      )}
      <div className="fld">
        <label htmlFor="a-title">Title</label>
        <input id="a-title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunrise over the food forest" />
      </div>
      <div className="fld">
        <label htmlFor="a-body">{kind === "copy" ? "Copy" : "Notes"}</label>
        <textarea
          id="a-body"
          name="body"
          rows={kind === "copy" ? 8 : 3}
          defaultValue={asset?.body ?? ""}
          placeholder={kind === "copy" ? "The caption, headline or paragraph, ready to reuse." : "Who shot it, usage rights, where the full-size file lives."}
        />
      </div>
      <BrandPicker value={asset?.brands ?? (brand ? [brand] : [])} />
      <div className="fld">
        <label htmlFor="a-tags">Tags</label>
        <input id="a-tags" name="tags" defaultValue={asset?.tags.join(", ") ?? ""} placeholder="harvest, sunrise, people" />
        <span className="hint">Separate with commas.</span>
      </div>
      {asset && (
        <p className="note">
          Added {fmtCr(asset.created_at)}. Used in {asset.uses} {asset.uses === 1 ? "item or post" : "items and posts"}.
        </p>
      )}
    </Drawer>
  );
}
