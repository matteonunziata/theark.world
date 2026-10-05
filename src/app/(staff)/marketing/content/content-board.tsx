"use client";

import { useOptimistic, useState, useTransition } from "react";
import { initials } from "@/components/avatar";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { dayLabel, todayIn } from "@/lib/dates";
import { type BrandKey, STAGES, STUCK_DAYS, stageName } from "@/lib/marketing";
import { addComment, moveItem, saveItem } from "../actions";
import { BrandPicker, BrandTags } from "../nav";
import { AssetPicker, type AssetLite } from "./asset-picker";

type Comment = { id: string; body: string; created_at: string; author: string | null };
export type Item = Tables<"content_items"> & { asset_ids: string[]; comments: Comment[] };
type Member = { id: string; name: string };

export function ContentBoard({
  items,
  assets,
  team,
  me,
  brand,
  openId,
}: {
  items: Item[];
  assets: AssetLite[];
  team: Member[];
  me: string;
  brand: BrandKey | null;
  openId: string | null;
}) {
  const toast = useToast();
  const [, start] = useTransition();
  const [over, setOver] = useState("");
  const [shown, move] = useOptimistic(items, (cur, m: { id: string; stage: string }) =>
    cur.map((i) => (i.id === m.id ? { ...i, stage: m.stage, stage_changed_at: new Date().toISOString() } : i)),
  );
  const drawer = useDrawer<Item>();
  const [opened, setOpened] = useState(false);
  // Open the item named in the URL (links from strategy pages) once.
  if (openId && !opened) {
    const it = items.find((i) => i.id === openId);
    setOpened(true);
    if (it) drawer.openItem(it);
  }
  const today = todayIn();
  const now = new Date(`${today}T12:00:00Z`).getTime();

  const drop = (id: string, stage: string) => {
    const cur = shown.find((i) => i.id === id);
    if (!cur || cur.stage === stage) return;
    start(async () => {
      move({ id, stage });
      const r = await moveItem(id, stage);
      if (!r.ok) toast(r.error ?? "");
    });
  };
  const current = drawer.item ? (items.find((i) => i.id === drawer.item!.id) ?? drawer.item) : null;

  return (
    <>
      <div className="mk-toolbar">
        <span className="muted">
          {shown.length} {shown.length === 1 ? "item" : "items"}. Drag a card to move it along.
        </span>
        <button type="button" className="btn primary" onClick={drawer.openNew}>
          New item
        </button>
      </div>
      <div className="pipe mk-board">
        <div className="board">
          {STAGES.map(([sk, sl]) => {
            const list = shown.filter((i) => i.stage === sk);
            return (
              <section
                key={sk}
                className={`col ${over === sk ? "over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(sk);
                }}
                onDragLeave={() => setOver("")}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver("");
                  drop(e.dataTransfer.getData("text/plain"), sk);
                }}
              >
                <header>
                  {sl}
                  <span>{list.length}</span>
                </header>
                {list.map((i) => {
                  const days = Math.floor((now - new Date(i.stage_changed_at).getTime()) / 86400000);
                  const stuck = i.stage !== "published" && days >= STUCK_DAYS;
                  const who = team.find((m) => m.id === i.assignee_id);
                  const late = i.due_date && i.due_date < today && i.stage !== "published";
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className="task"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                      onClick={() => drawer.openItem(i)}
                    >
                      <BrandTags brands={i.brands} />
                      <b>{i.title}</b>
                      <span className="tmeta">
                        <span>
                          {i.due_date ? (
                            <span className={`due ${late ? "late" : ""}`}>{dayLabel(i.due_date, today)}</span>
                          ) : null}
                          {stuck && <span className="stuck"> {days} days here</span>}
                        </span>
                        <span className="tcount">
                          {i.asset_ids.length > 0 && <span>{i.asset_ids.length} {i.asset_ids.length === 1 ? "file" : "files"}</span>}
                          {i.comments.length > 0 && <span>{i.comments.length} {i.comments.length === 1 ? "note" : "notes"}</span>}
                          {who && (
                            <span className="av" title={who.name}>
                              {initials(who.name)}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {!list.length && <p className="muted col-empty">Nothing here</p>}
              </section>
            );
          })}
        </div>
      </div>

      <ItemDrawer
        key={current?.id ?? "new"}
        open={drawer.open}
        item={current}
        assets={assets}
        team={team}
        me={me}
        brand={brand}
        onClose={drawer.close}
      />
    </>
  );
}

function ItemDrawer({
  open,
  item,
  assets,
  team,
  me,
  brand,
  onClose,
}: {
  open: boolean;
  item: Item | null;
  assets: AssetLite[];
  team: Member[];
  me: string;
  brand: BrandKey | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const [comments, setComments] = useState<Comment[]>(item?.comments ?? []);
  const myName = team.find((m) => m.id === me)?.name ?? "You";

  return (
    <Drawer
      title={item ? "Content item" : "New content item"}
      open={open}
      onClose={onClose}
      action={saveItem}
      footer={
        <>
          {item && <ConfirmButton />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{item ? "Save" : "Add"}</button>
        </>
      }
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="fld">
        <label htmlFor="ci-title">Title</label>
        <input id="ci-title" name="title" required defaultValue={item?.title} placeholder="e.g. Harvest of the week: mangoes" autoFocus={!item} />
      </div>
      <div className="fld">
        <label htmlFor="ci-brief">Brief</label>
        <textarea id="ci-brief" name="brief" rows={5} defaultValue={item?.brief ?? ""} placeholder="What it is, who it’s for, the one thing it should say, format and length, where it will run." />
      </div>
      <BrandPicker value={item?.brands ?? (brand ? [brand] : [])} />
      <div className="grid2">
        <div className="fld">
          <label htmlFor="ci-stage">Stage</label>
          <select id="ci-stage" name="stage" defaultValue={item?.stage ?? "idea"}>
            {STAGES.map(([k, n]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="ci-due">Due</label>
          <input id="ci-due" name="due_date" type="date" defaultValue={item?.due_date ?? ""} />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="ci-who">Assignee</label>
        <select id="ci-who" name="assignee_id" defaultValue={item?.assignee_id ?? (item ? "" : me)}>
          <option value="">No one yet</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <AssetPicker assets={assets} selected={item?.asset_ids ?? []} />

      {item && (
        <>
          <div className="subhead">Comments</div>
          <div className="notes">
            {comments.length ? (
              comments.map((c) => (
                <div className="n" key={c.id}>
                  <time>
                    {new Date(c.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "America/Costa_Rica",
                    })}
                    {c.author ? `, ${c.author}` : ""}
                  </time>
                  <p>{c.body}</p>
                </div>
              ))
            ) : (
              <p className="muted" style={{ margin: 0 }}>No comments yet.</p>
            )}
          </div>
          <div className="addnote" style={{ marginTop: 10 }}>
            <textarea aria-label="New comment" placeholder="Feedback, a question, a link…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button
              type="button"
              className="btn"
              disabled={pending || !comment.trim()}
              onClick={() =>
                start(async () => {
                  const r = await addComment(item.id, comment);
                  if (!r.ok) return toast(r.error ?? "");
                  setComments((cs) => [
                    ...cs,
                    { id: crypto.randomUUID(), body: comment.trim(), created_at: new Date().toISOString(), author: myName },
                  ]);
                  setComment("");
                })
              }
            >
              Comment
            </button>
          </div>
          <p className="note">
            In {stageName(item.stage).toLowerCase()} since{" "}
            {new Date(item.stage_changed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Costa_Rica" })}.
          </p>
        </>
      )}
    </Drawer>
  );
}
