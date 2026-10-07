"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { useToast } from "@/components/toast";
import { reviewApplication } from "../actions";

type App = {
  id: string;
  planName: string;
  status: string;
  created_at: string;
  tried_day_pass: boolean | null;
  invited_by: string | null;
  building: string;
  why_join: string;
  contributing: string;
  drawn_to: string[];
  invites: string[];
  freePass: boolean;
  contact: { id: string; name: string; email: string | null; phone: string | null };
};

const FILTERS = [
  ["open", "To review"],
  ["approved", "Approved"],
  ["declined", "Declined"],
  ["all", "All"],
] as const;

const LABEL: Record<string, string> = { new: "New", reviewing: "Reviewing", approved: "Approved", declined: "Declined" };

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Costa_Rica" });

export function ApplicationsView({ apps }: { apps: App[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("open");
  const [pending, start] = useTransition();
  const toast = useToast();
  const isOpen = (a: App) => a.status === "new" || a.status === "reviewing";
  const count = (f: string) =>
    apps.filter((a) => (f === "open" ? isOpen(a) : f === "all" || a.status === f)).length;
  const list = apps.filter((a) => (filter === "open" ? isOpen(a) : filter === "all" || a.status === filter));

  const review = (id: string, status: string) =>
    start(async () => {
      const r = await reviewApplication(id, status);
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  return (
    <>
      <div className="pills">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" className="pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {l} ({count(k)})
          </button>
        ))}
      </div>
      {!list.length ? (
        <div className="empty">
          <p>{apps.length ? "Nothing here." : "No applications yet. They show up here when someone applies on the membership page."}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((a) => (
            <details key={a.id} className="form-card" open={isOpen(a) && list.length <= 3}>
              <summary style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", listStyle: "none" }}>
                <Avatar name={a.contact.name} color="var(--leaf)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.contact.name}</b>
                  <div className="muted" style={{ fontSize: 13.5 }}>
                    {a.planName} · applied {when(a.created_at)}
                    {a.freePass ? " · free day pass given" : ""}
                  </div>
                </div>
                <span className={`tier ${a.status === "approved" ? "" : "none"}`}>{LABEL[a.status] ?? a.status}</span>
              </summary>
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                <p className="muted" style={{ margin: 0 }}>
                  {[a.contact.email, a.contact.phone].filter(Boolean).join(" · ")}
                  {a.invited_by ? ` · Invited by ${a.invited_by}` : ""}
                  {a.tried_day_pass ? " · Has visited on a day pass" : ""}
                </p>
                <Answer q="What they’re building" a={a.building} />
                <Answer q="Why The ARK" a={a.why_join} />
                <Answer q="What they’d bring" a={a.contributing} />
                {a.drawn_to.length > 0 && <Answer q="Drawn to" a={a.drawn_to.join(", ")} />}
                {a.invites.length > 0 && <Answer q="Would invite" a={a.invites.join(", ")} />}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {a.status !== "approved" && (
                    <button type="button" className="btn primary sm" disabled={pending} onClick={() => review(a.id, "approved")}>
                      Approve
                    </button>
                  )}
                  {a.status === "new" && (
                    <button type="button" className="btn sm" disabled={pending} onClick={() => review(a.id, "reviewing")}>
                      Mark as reviewing
                    </button>
                  )}
                  {a.status !== "declined" && (
                    <button type="button" className="btn sm" disabled={pending} onClick={() => review(a.id, "declined")}>
                      Decline
                    </button>
                  )}
                  {(a.status === "approved" || a.status === "declined") && (
                    <button type="button" className="btn sm" disabled={pending} onClick={() => review(a.id, "new")}>
                      Reopen
                    </button>
                  )}
                  <Link className="btn sm" href={`/crm/contact/${a.contact.id}`} style={{ marginLeft: "auto" }}>
                    Open in CRM
                  </Link>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

function Answer({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
        {q}
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{a}</div>
    </div>
  );
}
