"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ConfirmButton } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { fmtCr, crTime, LISTS, listName, pct, toCrLocal } from "@/lib/marketing";
import { saveCampaign, scheduleCampaign, sendCampaignNow, testCampaign } from "../../actions";
import { BrandPicker, BrandTags } from "../../nav";

type Campaign = Tables<"email_campaigns">;
type Stats = Record<"sent" | "failed" | "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed", number>;

export function CampaignEditor({
  campaign: c,
  listSizes,
  stats,
  myEmail,
}: {
  campaign: Campaign;
  listSizes: Record<string, number>;
  stats: Stats;
  myEmail: string | null;
}) {
  const toast = useToast();
  const [state, save, saving] = useActionState(saveCampaign, { ok: false } as ActionResult);
  const [pending, start] = useTransition();
  const [list, setList] = useState(c.list_key);
  const [when, setWhen] = useState(c.scheduled_at ? toCrLocal(c.scheduled_at) : "");
  const [armed, setArmed] = useState(false);
  const locked = c.status === "sent" || c.status === "sending";

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state, toast]);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  return (
    <div className="camp">
      <div className="camp-head">
        <div>
          <h2>{c.name}</h2>
          <span className="muted">
            {c.status === "sent" && c.sent_at
              ? `Sent ${fmtCr(c.sent_at)} at ${crTime(c.sent_at)} to ${listName(c.list_key).toLowerCase()}`
              : c.status === "scheduled" && c.scheduled_at
                ? `Scheduled for ${fmtCr(c.scheduled_at, { weekday: "short", month: "short", day: "numeric" })} at ${crTime(c.scheduled_at)}, Costa Rica time`
                : c.status === "sending"
                  ? "Sending now"
                  : "Draft"}
          </span>
        </div>
        <BrandTags brands={c.brands} />
      </div>

      {(locked || stats.sent > 0) && (
        <div className="kpis camp-stats">
          <div className="kpi"><span>Sent</span><b>{stats.sent}</b><small>{stats.failed ? `${stats.failed} failed` : `${stats.delivered} delivered`}</small></div>
          <div className="kpi"><span>Opened</span><b>{pct(stats.opened, stats.sent)}</b><small>{stats.opened} people</small></div>
          <div className="kpi"><span>Clicked</span><b>{pct(stats.clicked, stats.sent)}</b><small>{stats.clicked} people</small></div>
          <div className="kpi"><span>Unsubscribed</span><b>{stats.unsubscribed}</b><small>{stats.bounced} bounced</small></div>
        </div>
      )}

      <form action={save} className="panel">
        <input type="hidden" name="id" value={c.id} />
        {!state.ok && state.error && <div className="form-error" role="alert">{state.error}</div>}
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="c-name">Name</label>
              <input id="c-name" name="name" required defaultValue={c.name} />
            </div>
            <div className="fld">
              <label htmlFor="c-list">Send to</label>
              <select id="c-list" name="list_key" value={list} onChange={(e) => setList(e.target.value)}>
                {LISTS.map(([k, n]) => (
                  <option key={k} value={k}>{n} ({listSizes[k] ?? 0})</option>
                ))}
              </select>
            </div>
          </div>
          <BrandPicker value={c.brands} />
          <div className="fld">
            <label htmlFor="c-subject">Subject</label>
            <input id="c-subject" name="subject" defaultValue={c.subject} placeholder="Short and specific, e.g. The farm shop opens Saturday" />
          </div>
          <div className="fld">
            <label htmlFor="c-body">Message</label>
            <textarea
              id="c-body"
              name="body"
              rows={16}
              defaultValue={c.body}
              placeholder={"Hi {{first_name}},\n\n…"}
              className="mono-ish"
            />
            <span className="hint">
              {"{{first_name}}"} and {"{{name}}"} fill in per person. Format with ## heading, **bold**, “- ” lists,
              ![description](https://image) and [[Button|https://link]]. Links get UTM tags when it sends, and
              every email has an unsubscribe link.
            </span>
          </div>
        </fieldset>
        {!locked && (
          <div className="camp-actions">
            <ConfirmButton />
            <span className="spacer" />
            <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        )}
      </form>

      {!locked && (
        <section className="panel">
          <h2>Send</h2>
          <p className="muted" style={{ marginTop: 0 }}>Save your changes first. Sending uses the saved version.</p>
          <div className="send-row">
            <div>
              <b>Test</b>
              <span className="muted">One copy to {myEmail ?? "your email"}, marked [Test].</span>
            </div>
            <button type="button" className="btn" disabled={pending} onClick={() => run(() => testCampaign(c.id))}>
              Send test
            </button>
          </div>
          <div className="send-row">
            <div>
              <b>Schedule</b>
              <span className="muted">Costa Rica time. Goes out at the next scheduled run after this time.</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="datetime-local" aria-label="Send at" value={when} onChange={(e) => setWhen(e.target.value)} />
              {c.status === "scheduled" ? (
                <>
                  <button type="button" className="btn" disabled={pending || !when} onClick={() => run(() => scheduleCampaign(c.id, when))}>Change</button>
                  <button type="button" className="btn ghost" disabled={pending} onClick={() => run(() => scheduleCampaign(c.id, null))}>Unschedule</button>
                </>
              ) : (
                <button type="button" className="btn" disabled={pending || !when} onClick={() => run(() => scheduleCampaign(c.id, when))}>Schedule</button>
              )}
            </div>
          </div>
          <div className="send-row">
            <div>
              <b>Send now</b>
              <span className="muted">
                To {listSizes[list] ?? 0} {listSizes[list] === 1 ? "person" : "people"} on {listName(list).toLowerCase()}. People who unsubscribed are left out.
              </span>
            </div>
            {armed ? (
              <button type="button" className="btn primary armed" disabled={pending} onClick={() => run(() => sendCampaignNow(c.id))}>
                {pending ? "Sending…" : `Confirm: send to ${listSizes[list] ?? 0}`}
              </button>
            ) : (
              <button type="button" className="btn primary" disabled={pending} onClick={() => setArmed(true)}>Send now</button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
