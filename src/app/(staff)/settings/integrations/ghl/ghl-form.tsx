"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { disconnectGhl, rotateGhlWebhookKey, saveGhl, syncGhlNow, testGhl } from "../actions";

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

export function GhlForm({
  integration: i,
  hasToken,
  linked,
  events,
  webhookUrl,
  webhookReady,
  canEdit,
}: {
  integration: Omit<Tables<"integrations">, "secret">;
  hasToken: boolean;
  linked: number;
  events: Event[];
  webhookUrl: string;
  webhookReady: boolean;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [state, save, saving] = useActionState(saveGhl, { ok: false } as ActionResult);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast("Webhook address copied");
    } catch {
      toast("Couldn’t copy. Select the address and copy it by hand.");
    }
  };

  return (
    <div className="integ-page">
      <div className="camp-head">
        <div>
          <h2>GoHighLevel</h2>
          <span className={`status-dot${connected && i.enabled ? " on" : ""}`}>{status}</span>
        </div>
        {connected && canEdit && (
          <div className="head-actions">
            <button type="button" className="btn" disabled={pending} onClick={() => run(testGhl)}>
              Test connection
            </button>
            <button type="button" className="btn primary" disabled={pending || !i.enabled} onClick={() => run(syncGhlNow)}>
              {pending ? "Working…" : "Sync now"}
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
          <span>Linked contacts</span>
          <b>{linked}</b>
          <small>People that exist in both</small>
        </div>
        <div className="kpi">
          <span>Last sync</span>
          <b>{when(i.last_sync_at)}</b>
          <small>Runs daily, on Sync now, and after each CRM save</small>
        </div>
        <div className="kpi">
          <span>Direction</span>
          <b>{i.direction === "both" ? "Both ways" : i.direction === "push" ? "ARK OS → GHL" : "GHL → ARK OS"}</b>
          <small>Tagged {i.tag} in GHL</small>
        </div>
      </div>

      <form action={save} className="form-card">
        <fieldset disabled={!canEdit || saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel-h">
            <div>
              <h2>Connection</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                In your GHL sub-account go to Settings → Private Integrations → Create new integration, give it the
                contacts scopes (read and write), and copy the token here. The Location ID is in Settings → Business
                Profile.
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
              <label htmlFor="g-loc">Location ID</label>
              <input id="g-loc" name="location_id" defaultValue={i.location_id ?? ""} placeholder="ve9EPM428h8vShlRW1KT" required />
            </div>
            <div className="fld">
              <label htmlFor="g-tok">Private integration token</label>
              <input
                id="g-tok"
                name="secret"
                type="password"
                autoComplete="off"
                placeholder={hasToken ? "Saved. Paste a new one to replace it." : "pit-…"}
              />
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="g-dir">Which way</label>
              <select id="g-dir" name="direction" defaultValue={i.direction}>
                <option value="both">Both ways</option>
                <option value="push">ARK OS → GHL only</option>
                <option value="pull">GHL → ARK OS only</option>
              </select>
              <span className="hint">
                Going out: every contact with an email or phone, with ark: tags for tier, status and pipeline stage.
                Coming in: new people are added to the CRM; people we know only get empty fields filled.
              </span>
            </div>
            <div className="fld">
              <label htmlFor="g-tag">Tag in GHL</label>
              <input id="g-tag" name="tag" defaultValue={i.tag} pattern="\S+" />
              <span className="hint">Put on everyone ARK OS sends, so you can filter on it.</span>
            </div>
          </div>
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
                    run(disconnectGhl);
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
          <div>
            <h2>Webhook from GHL</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              For leads to show up in the CRM right away instead of at the daily sync. In a GHL workflow (for example on
              Contact created), add a Webhook action: POST to this address, JSON body, and send at least the contact id,
              name, email and phone.
            </p>
          </div>
        </div>
        {!webhookReady && (
          <p className="note">
            The webhook needs SUPABASE_SERVICE_ROLE_KEY set on the server. Until then, the daily sync and Sync now still
            bring contacts in.
          </p>
        )}
        <div className="fld">
          <label htmlFor="g-wh">Address</label>
          <div className="integ-copy">
            <input id="g-wh" readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn" onClick={copy}>
              Copy
            </button>
          </div>
          <span className="hint">The key in the address is what tells us it’s GHL. Keep it out of screenshots.</span>
        </div>
        <details className="integ-example">
          <summary>Body to paste into the webhook action</summary>
          <pre>{`{
  "id": "{{contact.id}}",
  "name": "{{contact.name}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "tags": "{{contact.tags}}",
  "source": "{{contact.source}}"
}`}</pre>
        </details>
        {canEdit && (
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(rotateGhlWebhookKey)}>
            New address
          </button>
        )}
      </section>

      <section className="panel">
        <div className="panel-h">
          <h2>Recent activity</h2>
        </div>
        {events.length === 0 ? (
          <p className="muted">Nothing yet. Connect, then Sync now.</p>
        ) : (
          <ul className="integ-log">
            {events.map((e) => (
              <li key={e.id} className={e.ok ? "" : "bad"}>
                <span className="when">{when(e.created_at)}</span>
                <span className="tag-sm">{e.direction === "out" ? "→ GHL" : "← GHL"}</span>
                <span className="what">{e.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
