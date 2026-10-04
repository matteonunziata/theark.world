"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { createPost, deletePost } from "../../actions";
import { Av } from "../../ui";

type Post = {
  id: string;
  parent_id: string | null;
  city_id: string | null;
  body: string;
  created_at: string;
  author_name: string;
  author_contact_id: string | null;
  from_team: boolean;
  mine: boolean;
};

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function FeedView({
  posts,
  cities,
  cityId,
  canDeleteAll,
}: {
  posts: Post[];
  cities: { id: string; name: string }[];
  cityId: string | null;
  canDeleteAll: boolean;
}) {
  const [body, setBody] = useState("");
  const [tagCity, setTagCity] = useState(cityId ?? "");
  const [only, setOnly] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const cityName = (id: string | null) => cities.find((c) => c.id === id)?.name;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        after?.();
        router.refresh();
      } else toast(r.error ?? "");
    });

  const top = posts.filter((p) => !p.parent_id && (!only || p.city_id === only));
  const replies = (id: string) =>
    posts.filter((p) => p.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const PostBody = ({ p }: { p: Post }) => (
    <>
      <div className="who">
        <Av id={p.author_contact_id ?? p.id} name={p.author_name} size="sm" />
        <div>
          <b>{p.author_name.replace(" · The ARK team", "")}</b>{" "}
          {p.from_team && <span className="pv-team">The ARK</span>}{" "}
          <span>
            {ago(p.created_at)}
            {cityName(p.city_id) && !p.parent_id ? ` · ${cityName(p.city_id)}` : ""}
          </span>
        </div>
      </div>
      <p className="text">{p.body}</p>
    </>
  );

  return (
    <div className="pv-two" style={{ gridTemplateColumns: "1fr" }}>
      <form
        className="pv-panel pv-compose"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createPost(body, tagCity || null, null), () => setBody(""));
        }}
      >
        <textarea
          aria-label="Write a post"
          placeholder="Share a plan, a find, or an invitation. Dawn surf tomorrow? Spare seat to San José?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
        />
        <div className="row">
          <select className="pv-input" style={{ width: "auto", padding: "8px 12px" }} aria-label="City" value={tagCity} onChange={(e) => setTagCity(e.target.value)}>
            <option value="">No city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button type="submit" className="pv-btn" disabled={pending || !body.trim()}>
            Post
          </button>
        </div>
      </form>

      {cities.length > 1 && (
        <div className="pv-pills" role="group" aria-label="Filter by city">
          <button type="button" className="pv-pill" aria-pressed={!only} onClick={() => setOnly("")}>
            Everywhere
          </button>
          {cities.map((c) => (
            <button key={c.id} type="button" className="pv-pill" aria-pressed={only === c.id} onClick={() => setOnly(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="pv-panel">
        {!top.length ? (
          <p style={{ margin: 0, color: "var(--pv-muted)" }}>Quiet in here. Start the conversation.</p>
        ) : (
          top.map((p) => (
            <article className="pv-post" key={p.id}>
              <PostBody p={p} />
              <div className="acts">
                <button type="button" onClick={() => setReplyTo(replyTo === p.id ? null : p.id)}>
                  Reply{replies(p.id).length ? ` · ${replies(p.id).length}` : ""}
                </button>
                {(p.mine || canDeleteAll) && (
                  <button type="button" onClick={() => run(() => deletePost(p.id))}>
                    Remove
                  </button>
                )}
              </div>
              {(replies(p.id).length > 0 || replyTo === p.id) && (
                <div className="pv-replies">
                  {replies(p.id).map((r) => (
                    <div className="pv-post" key={r.id}>
                      <PostBody p={r} />
                      {(r.mine || canDeleteAll) && (
                        <div className="acts">
                          <button type="button" onClick={() => run(() => deletePost(r.id))}>
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {replyTo === p.id && (
                    <form
                      className="pv-compose"
                      style={{ marginTop: 8 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() => createPost(reply, p.city_id, p.id), () => {
                          setReply("");
                          setReplyTo(null);
                        });
                      }}
                    >
                      <textarea
                        aria-label="Reply"
                        placeholder={`Reply to ${p.author_name.split(" ")[0]}`}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        style={{ minHeight: 60 }}
                        autoFocus
                      />
                      <div className="row">
                        <span />
                        <button type="submit" className="pv-btn sm" disabled={pending || !reply.trim()}>
                          Reply
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
