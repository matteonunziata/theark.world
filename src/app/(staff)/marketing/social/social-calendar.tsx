"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { addDays, addMonths, DOW, monthLabel } from "@/lib/dates";
import {
  type BrandKey,
  brandColor,
  CHANNELS,
  type Channel,
  channelName,
  crDate,
  crTime,
  POST_STATUS,
  postStatusName,
  toCrLocal,
} from "@/lib/marketing";
import { markPublished, reschedulePost, savePost } from "../actions";
import { AssetPicker, type AssetLite } from "../content/asset-picker";
import { BrandPicker } from "../nav";

export type Post = Tables<"social_posts"> & { asset_ids: string[] };

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function SocialCalendar({
  posts,
  assets,
  items,
  view,
  anchor,
  first,
  last,
  today,
  brand,
  channel,
}: {
  posts: Post[];
  assets: AssetLite[];
  items: { id: string; title: string }[];
  view: "month" | "week";
  anchor: string;
  first: string;
  last: string;
  today: string;
  brand: BrandKey | null;
  channel: Channel | null;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [, start] = useTransition();
  const [over, setOver] = useState("");
  const drawer = useDrawer<Post>();
  const [newOn, setNewOn] = useState<string | null>(null);
  const [shown, move] = useOptimistic(posts, (cur, m: { id: string; date: string }) =>
    cur.map((p) =>
      p.id === m.id
        ? { ...p, scheduled_at: new Date(`${m.date}T${toCrLocal(p.scheduled_at).slice(11, 16)}:00-06:00`).toISOString() }
        : p,
    ),
  );

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${path}?${next}`);
  };
  const step = (n: number) =>
    go({ d: view === "week" ? addDays(anchor, 7 * n) : `${addMonths(anchor.slice(0, 7), n)}-01` });

  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  const byDay = (d: string) => shown.filter((p) => crDate(p.scheduled_at) === d);

  const drop = (id: string, date: string) => {
    const p = shown.find((x) => x.id === id);
    if (!p || crDate(p.scheduled_at) === date) return;
    if (p.status === "published") return toast("Published posts stay where they are.");
    start(async () => {
      move({ id, date });
      const r = await reschedulePost(id, date);
      toast(r.ok ? `Moved to ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}` : (r.error ?? ""));
    });
  };

  const title =
    view === "month"
      ? monthLabel(anchor.slice(0, 7))
      : `${fmtDay(first)} – ${fmtDay(last)}`;

  return (
    <>
      <div className="monthnav">
        <span className="range">{title}</span>
        <button type="button" className="btn" onClick={() => step(-1)} aria-label="Previous">←</button>
        <button type="button" className="btn" onClick={() => go({ d: null })}>Today</button>
        <button type="button" className="btn" onClick={() => step(1)} aria-label="Next">→</button>
        <div className="seg" style={{ margin: 0 }}>
          <button type="button" className={view === "month" ? "on" : ""} onClick={() => go({ view: null })}>Month</button>
          <button type="button" className={view === "week" ? "on" : ""} onClick={() => go({ view: "week" })}>Week</button>
        </div>
        <select aria-label="Channel" value={channel ?? ""} onChange={(e) => go({ channel: e.target.value || null })}>
          <option value="">All channels</option>
          {CHANNELS.map(([k, n]) => (
            <option key={k} value={k}>{n}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setNewOn(today >= first && today <= last ? today : first);
            drawer.openNew();
          }}
        >
          New post
        </button>
      </div>

      <div className={`soc-cal ${view}`}>
        {WEEK.map((d) => (
          <div key={d} className="soc-dow">{DOW[d]}</div>
        ))}
        {days.map((d) => {
          const list = byDay(d);
          const outside = view === "month" && d.slice(0, 7) !== anchor.slice(0, 7);
          return (
            <div
              key={d}
              className={`soc-day ${outside ? "out" : ""} ${d === today ? "today" : ""} ${over === d ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(d);
              }}
              onDragLeave={() => setOver("")}
              onDrop={(e) => {
                e.preventDefault();
                setOver("");
                drop(e.dataTransfer.getData("text/plain"), d);
              }}
              onDoubleClick={() => {
                setNewOn(d);
                drawer.openNew();
              }}
            >
              <span className="num">{Number(d.slice(8))}</span>
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`soc-post st-${p.status}`}
                  style={{ "--bc": brandColor(p.brands[0]) } as React.CSSProperties}
                  draggable={p.status !== "published"}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                  onClick={() => drawer.openItem(p)}
                  title={`${postStatusName(p.status)}: ${p.channels.map(channelName).join(", ")}`}
                >
                  <span className="t">{crTime(p.scheduled_at)}</span>
                  <span className="c">{p.caption.split("\n")[0] || "Untitled post"}</span>
                  {view === "week" && (
                    <span className="ch">{p.channels.map(channelName).join(" · ")}</span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="soc-legend">
        <span><i className="st-draft" /> Draft</span>
        <span><i className="st-ready" /> Ready to post</span>
        <span><i className="st-published" /> Published</span>
        <span className="muted">Colour is the brand. Drag a post to another day; double-click a day to plan one. Times are Costa Rica time.</span>
      </div>

      <PostDrawer
        key={drawer.item?.id ?? `new-${newOn}`}
        open={drawer.open}
        post={drawer.item}
        defaultDate={newOn ?? today}
        assets={assets}
        items={items}
        brand={brand}
        onClose={drawer.close}
      />
    </>
  );
}

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function PostDrawer({
  open,
  post,
  defaultDate,
  assets,
  items,
  brand,
  onClose,
}: {
  open: boolean;
  post: Post | null;
  defaultDate: string;
  assets: AssetLite[];
  items: { id: string; title: string }[];
  brand: BrandKey | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(post?.status ?? "draft");
  const [caption, setCaption] = useState(post?.caption ?? "");

  return (
    <Drawer
      title={post ? "Post" : "Plan a post"}
      open={open}
      onClose={onClose}
      action={savePost}
      footer={
        <>
          {post && <ConfirmButton />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{post ? "Save" : "Plan post"}</button>
        </>
      }
    >
      {post && <input type="hidden" name="id" value={post.id} />}
      {post && post.status === "ready" && (
        <div className="banner" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <span>Ready to post. Mark it once it’s live.</span>
          <button
            type="button"
            className="btn primary sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await markPublished(post.id);
                toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
                if (r.ok) onClose();
              })
            }
          >
            Mark as published
          </button>
        </div>
      )}
      <BrandPicker value={post?.brands ?? (brand ? [brand] : [])} />
      <fieldset className="fld" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
        <legend className="lbl" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Channels</legend>
        <div className="chk-row">
          {CHANNELS.map(([k, n]) => (
            <label key={k} className="chk-pill">
              <input type="checkbox" name="channels" value={k} defaultChecked={post?.channels.includes(k) ?? k === "instagram"} />
              <span>{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="fld">
        <label htmlFor="p-cap">Caption</label>
        <textarea id="p-cap" name="caption" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="The words that go with it. The first line shows on the calendar." />
        <span className="hint">{caption.length} characters{caption.length > 2200 ? ", over Instagram’s 2,200" : ""}</span>
      </div>
      <AssetPicker assets={assets} selected={post?.asset_ids ?? []} label="Photos and video" />
      <div className="grid2">
        <div className="fld">
          <label htmlFor="p-when">Date and time (Costa Rica)</label>
          <input id="p-when" name="when" type="datetime-local" required defaultValue={post ? toCrLocal(post.scheduled_at) : `${defaultDate}T10:00`} />
        </div>
        <div className="fld">
          <label htmlFor="p-status">Status</label>
          <select id="p-status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {POST_STATUS.map(([k, n]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="fld">
        <label htmlFor="p-link">Link in the post</label>
        <input id="p-link" name="link" type="url" defaultValue={post?.link ?? ""} placeholder="https://theark.world/…" />
        <span className="hint">UTM tags are added when you save, so sign-ups from this post show up under its channel.</span>
      </div>
      <div className="fld">
        <label htmlFor="p-item">From content item</label>
        <select id="p-item" name="content_item_id" defaultValue={post?.content_item_id ?? ""}>
          <option value="">None</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.title}</option>
          ))}
        </select>
      </div>
      {status === "published" && (
        <>
          <div className="subhead">Engagement</div>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>Typed in by hand for now, from each channel’s insights.</p>
          <div className="eng-grid">
            {(["reach", "likes", "comments", "shares", "saves"] as const).map((k) => (
              <div className="fld" key={k}>
                <label htmlFor={`p-${k}`}>{k[0].toUpperCase() + k.slice(1)}</label>
                <input id={`p-${k}`} name={k} type="number" min={0} defaultValue={post?.[k] ?? ""} />
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}
