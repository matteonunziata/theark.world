"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { KINDS, parseRules } from "@/lib/slack-format";
import { disconnectSlack, saveSlack, sendSlackDigest, sendSlackTest, testSlack } from "../actions";

type Event = Pick<Tables<"integration_events">, "id" | "direction" | "kind" | "ok" | "detail" | "created_at">;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "America/Costa_Rica",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

export function SlackForm({
  integration: i,
  hasToken,
  posted,
  events,
  canEdit,
  serviceReady,
}: {
  integration: Omit<Tables<"integrations">, "secret">;
  hasToken: boolean;
  posted: number;
  events: Event[];
  canEdit: boolean;
  serviceReady: boolean;
}) {
  const toast = useToast();
  const [state, save, saving] = useActionState(saveSlack, { ok: false } as ActionResult);
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state, toast]);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });
  const connected = !!i.connected_at && hasToken;
  const status = !connected ? "Not connected" : i.enabled ? "On" : "Connected, paused";
  const rules = parseRules(i.rules);
  const on = Object.values(rules).filter((r) => r.on).length;
  const lastPost = events.find((e) => e.ok && (e.kind === "notify" || e.kind === "digest"))?.created_at ?? null;

  return (
    <div className="integ-page">
      <div className="camp-head">
        <div>
          <h2>Slack</h2>
          <span className={`status-dot${connected && i.enabled ? " on" : ""}`}>
            {status}
            {connected && i.account_name ? ` · ${i.account_name}` : ""}
          </span>
        </div>
        {connected && canEdit && (
          <div className="head-actions">
            <button type="button" className="btn" disabled={pending} onClick={() => run(testSlack)}>
              Test connection
            </button>
            <button type="button" className="btn" disabled={pending || !i.channel} onClick={() => run(sendSlackTest)}>
              Send a test message
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={pending || !i.enabled || !rules.digest?.on}
              title={!rules.digest?.on ? "Switch on the morning digest below first" : undefined}
              onClick={() => run(sendSlackDigest)}
            >
              {pending ? "Working…" : "Post today’s digest"}
            </button>
          </div>
        )}
      </div>

      {i.last_error && (
        <div className="form-error" role="alert">
          Last problem: {i.last_error}
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <span>Messages posted</span>
          <b>{posted}</b>
          <small>Since Slack was connected</small>
        </div>
        <div className="kpi">
          <span>Last message</span>
          <b>{when(lastPost)}</b>
          <small>Posted as things happen; the digest goes out at 7:30</small>
        </div>
        <div className="kpi">
          <span>Switched on</span>
          <b>
            {on} of {KINDS.length}
          </b>
          <small>{i.channel ? `Default channel ${i.channel}` : "No default channel yet"}</small>
        </div>
      </div>

      <form action={save} className="form-card">
        <fieldset disabled={!canEdit || saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel-h">
            <div>
              <h2>Connection</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                At api.slack.com/apps choose Create New App → From scratch, name it ARK OS, and pick your workspace.
                Under OAuth &amp; Permissions add the bot scopes <code>chat:write</code> and{" "}
                <code>chat:write.public</code>, then Install to Workspace and copy the Bot User OAuth Token.
              </p>
            </div>
            <label className="check">
              <input type="checkbox" name="enabled" defaultChecked={i.enabled} />
              On
            </label>
          </div>
          {!state.ok && state.error && <div className="form-error" role="alert">{state.error}</div>}
          <div className="grid2">
            <div className="fld">
              <label htmlFor="s-tok">Bot token</label>
              <input
                id="s-tok"
                name="secret"
                type="password"
                autoComplete="off"
                placeholder={hasToken ? "Saved. Paste a new one to replace it." : "xoxb-…"}
              />
            </div>
            <div className="fld">
              <label htmlFor="s-ch">Channel</label>
              <input id="s-ch" name="channel" defaultValue={i.channel ?? ""} placeholder="#ark-os" required />
              <span className="hint">
                Where everything goes unless a kind below has its own. Private channels need the app invited:
                type /invite @ARK OS in the channel.
              </span>
            </div>
          </div>

          <div className="panel-h" style={{ marginTop: 18 }}>
            <div>
              <h2>What to post</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Tick what the team wants to hear about. Leave a channel blank to use the one above.
              </p>
            </div>
          </div>
          <ul className="integ-rules">
            {KINDS.map(([key, name, hint]) => (
              <li key={key}>
                <label className="check">
                  <input type="checkbox" name={`on_${key}`} defaultChecked={rules[key]?.on ?? false} />
                  <span>
                    <b>{name}</b>
                    <small>{hint}</small>
                  </span>
                </label>
                <input
                  name={`channel_${key}`}
                  defaultValue={rules[key]?.channel ?? ""}
                  placeholder={i.channel ?? "#ark-os"}
                  aria-label={`Channel for ${name.toLowerCase()}`}
                />
              </li>
            ))}
          </ul>
          {!serviceReady && (
            <p className="note">
              Messages about things visitors and members do (applications, bookings, payments, requests to stay,
              guest invites) need SUPABASE_SERVICE_ROLE_KEY set on the server. Tests and the digest from this page
              work without it.
            </p>
          )}
          {canEdit && (
            <div className="camp-actions">
              {connected && (
                <button
                  type="button"
                  className={`btn danger${armed ? " armed" : ""}`}
                  disabled={pending}
                  onClick={() => {
                    if (!armed) return setArmed(true);
                    setArmed(false);
                    run(disconnectSlack);
                  }}
                  onBlur={() => setArmed(false)}
                >
                  {armed ? "Click again to disconnect" : "Disconnect"}
                </button>
              )}
              <span className="spacer" />
              <button type="submit" className="btn primary">
                {saving ? "Checking…" : connected ? "Save" : "Connect"}
              </button>
            </div>
          )}
        </fieldset>
      </form>

      <section className="panel">
        <div className="panel-h">
          <h2>Recent activity</h2>
        </div>
        {events.length === 0 ? (
          <p className="muted">Nothing yet. Connect, then send a test message.</p>
        ) : (
          <ul className="integ-log">
            {events.map((e) => (
              <li key={e.id} className={e.ok ? "" : "bad"}>
                <span className="when">{when(e.created_at)}</span>
                <span className="tag-sm">{e.kind === "digest" ? "Digest" : e.kind === "test" ? "Test" : "→ Slack"}</span>
                <span className="what">{e.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
