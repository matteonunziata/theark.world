"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { levelForPercent } from "@/lib/shopify-map";
import { disconnectShopify, saveShopify, setupShopifyDiscounts, syncShopifyNow, testShopify } from "./actions";

type Event = Pick<Tables<"integration_events">, "id" | "direction" | "kind" | "ok" | "detail" | "created_at">;
type Tier = Pick<Tables<"membership_tiers">, "key" | "name" | "period" | "court_discount">;

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

export function ShopifyForm({
  integration: i,
  hasSecret,
  linked,
  events,
  tiers,
  canEdit,
  cronReady,
}: {
  integration: Omit<Tables<"integrations">, "secret" | "access_token" | "token_expires_at" | "webhook_signing_secret">;
  hasSecret: boolean;
  linked: number;
  events: Event[];
  tiers: Tier[];
  canEdit: boolean;
  cronReady: boolean;
}) {
  const toast = useToast();
  const [state, save, saving] = useActionState(saveShopify, { ok: false } as ActionResult);
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
  const connected = !!i.connected_at && hasSecret;
  const status = !connected ? "Not connected" : i.enabled ? "On" : "Connected, paused";
  const settings = (i.settings ?? {}) as { discounts?: Record<string, string> };
  const codesReady = !!settings.discounts?.member10 && !!settings.discounts?.member20;

  return (
    <div className="integ-page">
      <div className="camp-head">
        <div>
          <h2>Shopify</h2>
          <span className={`status-dot${connected && i.enabled ? " on" : ""}`}>{status}</span>
        </div>
        {connected && canEdit && (
          <div className="head-actions">
            <button type="button" className="btn" disabled={pending} onClick={() => run(testShopify)}>
              Test connection
            </button>
            <button type="button" className="btn primary" disabled={pending || !i.enabled} onClick={() => run(syncShopifyNow)}>
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
          <span>Members in Shopify</span>
          <b>{linked}</b>
          <small>Customers ARK OS has tagged or created</small>
        </div>
        <div className="kpi">
          <span>Discount codes</span>
          <b>{codesReady ? "member10, member20" : "Not set up"}</b>
          <small>{codesReady ? "Limited to tagged customers" : "Created on the first sync, or with the button below"}</small>
        </div>
        <div className="kpi">
          <span>Last sync</span>
          <b>{when(i.last_sync_at)}</b>
          <small>Runs just after midnight, on Sync now, and when a membership is saved or paid</small>
        </div>
      </div>

      <form action={save} className="form-card">
        <fieldset disabled={!canEdit || saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel-h">
            <div>
              <h2>Connection</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                In the Shopify Dev Dashboard make an app for this store with the access scopes write_customers,
                write_discounts and write_orders (paid portal orders are created in Shopify), install it, then copy its client id and client secret here. An older custom app works
                too: leave the client id empty and paste its Admin API access token (shpat_…) as the secret.
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
              <label htmlFor="sh-shop">Store address</label>
              <input id="sh-shop" name="shop_domain" defaultValue={i.shop_domain ?? ""} placeholder="theark.myshopify.com" required autoComplete="off" />
              <span className="hint">The myshopify.com address, not the public domain.</span>
            </div>
            <div className="fld">
              <label htmlFor="sh-id">Client id</label>
              <input id="sh-id" name="client_id" defaultValue={i.client_id ?? ""} autoComplete="off" />
            </div>
          </div>
          <div className="fld">
            <label htmlFor="sh-sec">Client secret or access token</label>
            <input
              id="sh-sec"
              name="secret"
              type="password"
              autoComplete="off"
              placeholder={hasSecret ? "Saved. Paste a new one to replace it." : ""}
            />
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
                    run(disconnectShopify);
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
            <h2>Member discounts</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Members are tagged in Shopify and the two codes only work for tagged customers, signed in or checking out
              with the email on their membership. When a membership ends, pauses or hasn’t started, the tag comes off
              and the code stops working. Which code a tier gets follows its discount in Memberships → Tiers: 20% or
              more is member20, 10% or more is member10. Day and week passes get none.
            </p>
          </div>
          {canEdit && connected && (
            <button type="button" className="btn sm" disabled={pending} onClick={() => run(setupShopifyDiscounts)}>
              {codesReady ? "Check codes" : "Create codes"}
            </button>
          )}
        </div>
        <ul className="integ-map">
          {tiers.map((t) => {
            const l = levelForPercent(t.court_discount);
            return (
              <li key={t.key} className={l ? "" : "unlinked"}>
                <div className="who">
                  <b>{t.name}</b>
                  <span className="muted">{l ? `${l.percent}% off in the shop` : "No discount"}</span>
                </div>
                <span>{l ? l.code : "—"}</span>
              </li>
            );
          })}
        </ul>
        {!cronReady && (
          <p className="note">
            The nightly run needs CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY set on the server. Without them, endings are
            only picked up when someone presses Sync now.
          </p>
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
                <span className="tag-sm">→ Shopify</span>
                <span className="what">{e.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
