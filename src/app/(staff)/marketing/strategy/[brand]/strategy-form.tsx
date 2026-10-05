"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { resizeImage } from "@/components/cover-field";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { assetUrl, fmtCr } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/client";
import { addReference, removeReference, saveStrategy } from "../../actions";

const FIELDS = [
  {
    key: "story",
    label: "The story",
    hint: "Who we are, why this exists, what makes it different.",
    placeholder:
      "e.g. The farm feeds The ARK. Twelve acres of regenerative beds and a food forest, worked by the people who eat from it. What started as a kitchen garden is now…",
    rows: 6,
  },
  {
    key: "audience",
    label: "Audience",
    hint: "Who we’re talking to. Be specific: where they live, what they care about, what they’d search for.",
    placeholder: "e.g. Families in Santa Teresa and Malpaís who cook at home and want to know where their food comes from…",
    rows: 4,
  },
  {
    key: "key_messages",
    label: "Key messages",
    hint: "Three to five things every piece of content should leave people believing. One per line.",
    placeholder: "e.g.\n- Grown here, picked this morning\n- You can visit, and you can help\n- …",
    rows: 5,
  },
  {
    key: "pillars",
    label: "Content pillars",
    hint: "The recurring themes we come back to. One per line, with a line on what each covers.",
    placeholder: "e.g.\n- Harvest of the week: what’s ready and how to cook it\n- Hands in the soil: volunteer days, workshops\n- …",
    rows: 5,
  },
  {
    key: "tone",
    label: "Tone and voice",
    hint: "How we sound. Words we use and avoid, and an example sentence or two.",
    placeholder: "e.g. Warm, plain, specific. An invitation, never a sales pitch. No exclamation marks…",
    rows: 4,
  },
  {
    key: "channels",
    label: "Channels",
    hint: "Where this brand shows up, and what each channel is for.",
    placeholder: "e.g. Instagram for the weekly harvest, WhatsApp channel for the farm shop drop, email once a month…",
    rows: 3,
  },
  {
    key: "goals",
    label: "Goals this quarter",
    hint: "What we want to happen by the end of the quarter, with a number where we can.",
    placeholder: "e.g.\n- 300 people on the farm shop WhatsApp channel\n- Two volunteer days a month, 15 people each\n- …",
    rows: 4,
  },
] as const;

type Strategy = Tables<"brand_strategies">;
type Ref = Tables<"brand_refs">;

export function StrategyForm({
  brand,
  brandName,
  strategy,
  editedBy,
  refs,
}: {
  brand: string;
  brandName: string;
  strategy: Strategy | null;
  editedBy: string | null;
  refs: Ref[];
}) {
  const toast = useToast();
  const [state, action, pending] = useActionState(saveStrategy, { ok: false } as ActionResult);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    if (!state.ok && state.error) toast(state.error);
  }, [state, toast]);
  const edited = strategy?.updated_by && strategy.updated_at;

  return (
    <>
      <form action={action} className="panel strategy">
        <input type="hidden" name="brand" value={brand} />
        <div className="strategy-head">
          <h2>{brandName} strategy</h2>
          <span className="muted">
            {edited ? `Last edited ${fmtCr(strategy.updated_at)}${editedBy ? ` by ${editedBy}` : ""}` : "Not written yet"}
          </span>
        </div>
        {FIELDS.map((f) => (
          <div className="fld" key={f.key}>
            <label htmlFor={`s-${f.key}`}>{f.label}</label>
            <span className="hint" style={{ marginTop: 0, marginBottom: 6 }}>{f.hint}</span>
            <textarea
              id={`s-${f.key}`}
              name={f.key}
              rows={f.rows}
              defaultValue={strategy?.[f.key] ?? ""}
              placeholder={f.placeholder}
            />
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? "Saving…" : "Save strategy"}
          </button>
        </div>
      </form>
      <Moodboard brand={brand} refs={refs} />
    </>
  );
}

function Moodboard({ brand, refs }: { brand: string; refs: Ref[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
      if (r.ok) after?.();
    });

  async function upload(files: FileList) {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const blob = await resizeImage(file, 1800);
        const path = `moodboard/${brand}/${crypto.randomUUID()}.jpg`;
        const { error } = await createClient().storage.from("marketing").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const r = await addReference(brand, { path });
        if (!r.ok) throw new Error(r.error);
      }
      toast("Added to the moodboard");
    } catch {
      toast("Couldn’t upload that image. Try a JPG or PNG under 10 MB.");
    }
    setBusy(false);
  }

  return (
    <section className="panel">
      <h2>Reference and moodboard</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Photos, accounts and campaigns that feel right for this brand, and why.
      </p>
      <div className="mood-add">
        <label className="btn" style={{ cursor: "pointer" }}>
          {busy ? "Uploading…" : "Upload images"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && upload(e.target.files)} />
        </label>
        <input type="url" placeholder="https://… a link to a post, account or site" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Reference link" />
        <input placeholder="Why it’s here (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Note" />
        <button
          type="button"
          className="btn"
          disabled={pending || !url.trim()}
          onClick={() => run(() => addReference(brand, { url, caption }), () => { setUrl(""); setCaption(""); })}
        >
          Add link
        </button>
      </div>
      {refs.length ? (
        <div className="mood-grid">
          {refs.map((r) => (
            <figure key={r.id} className={r.path ? "img" : "link"}>
              {r.path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrl(r.path) ?? ""} alt={r.caption ?? ""} loading="lazy" />
              ) : (
                <a href={r.url ?? "#"} target="_blank" rel="noopener noreferrer">
                  {r.url?.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
                </a>
              )}
              {r.caption && <figcaption>{r.caption}</figcaption>}
              <button type="button" className="mood-x" aria-label="Remove" disabled={pending} onClick={() => run(() => removeReference(r.id))}>
                ×
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: "12px 0 0" }}>Nothing here yet.</p>
      )}
    </section>
  );
}
