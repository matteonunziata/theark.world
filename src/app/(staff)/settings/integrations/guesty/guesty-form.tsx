"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { lotTitle } from "@/lib/estate";
import {
  disconnectGuesty,
  mapGuestyListing,
  registerGuestyWebhook,
  rotateGuestyWebhookKey,
  saveGuesty,
  syncGuestyNow,
  testGuesty,
} from "../actions";

type Event = Pick<Tables<"integration_events">, "id" | "direction" | "kind" | "ok" | "detail" | "created_at">;
type Listing = Tables<"guesty_listings">;
type Lot = Pick<Tables<"lots">, "id" | "code" | "name" | "kind" | "in_hospitality" | "guesty_listing_id">;

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

const rate = (l: Listing) =>
  l.base_price !== null && l.currency
    ? `${l.currency === "USD" ? "$" : l.currency === "CRC" ? "₡" : `${l.currency} `}${Math.round(Number(l.base_price)).toLocaleString("en-US")}/night`
    : null;

export function GuestyForm({
  integration: i,
  hasSecret,
  signed,
  listings,
  lots,
  stays,
  events,
  webhookUrl,
  webhookReady,
  canEdit,
}: {
  integration: Omit<Tables<"integrations">, "secret" | "access_token" | "token_expires_at" | "webhook_signing_secret">;
  hasSecret: boolean;
  signed: boolean;
  listings: Listing[];
  lots: Lot[];
  stays: number;
  events: Event[];
  webhookUrl: string;
  webhookReady: boolean;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [state, save, saving] = useActionState(saveGuesty, { ok: false } as ActionResult);
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
  const lotOf = new Map(lots.filter((l) => l.guesty_listing_id).map((l) => [l.guesty_listing_id as string, l]));
  const linked = lots.filter((l) => l.guesty_listing_id).length;

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
          <h2>Guesty</h2>
          <span className={`status-dot${connected && i.enabled ? " on" : ""}`}>{status}</span>
        </div>
        {connected && canEdit && (
          <div className="head-actions">
            <button type="button" className="btn" disabled={pending} onClick={() => run(testGuesty)}>
              Test connection
            </button>
            <button type="button" className="btn primary" disabled={pending || !i.enabled} onClick={() => run(syncGuestyNow)}>
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
          <span>Homes linked</span>
          <b>{linked}</b>
          <small>
            {listings.length ? `of ${listings.length} listing${listings.length === 1 ? "" : "s"} in Guesty` : "Sync to see Guesty’s listings"}
          </small>
        </div>
        <div className="kpi">
          <span>Stays from Guesty</span>
          <b>{stays}</b>
          <small>Shown in Hospitality with the channel they came from</small>
        </div>
        <div className="kpi">
          <span>Last sync</span>
          <b>{when(i.last_sync_at)}</b>
          <small>Runs daily, on Sync now, and as each reservation changes (webhook)</small>
        </div>
      </div>

      <form action={save} className="form-card">
        <fieldset disabled={!canEdit || saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel-h">
            <div>
              <h2>Connection</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                In Guesty go to Settings → Integrations → Marketplace → Guesty Open API (or ask Guesty to turn it on),
                create an application, and copy its client id and client secret here. Reading listings and reservations
                is enough; blocking nights on the calendar needs write access to the calendar.
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
              <label htmlFor="gy-id">Client id</label>
              <input id="gy-id" name="client_id" defaultValue={i.client_id ?? ""} placeholder="0oa…" required autoComplete="off" />
            </div>
            <div className="fld">
              <label htmlFor="gy-sec">Client secret</label>
              <input
                id="gy-sec"
                name="secret"
                type="password"
                autoComplete="off"
                placeholder={hasSecret ? "Saved. Paste a new one to replace it." : ""}
              />
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="gy-dir">Which way</label>
              <select id="gy-dir" name="direction" defaultValue={i.direction === "both" ? "both" : "pull"}>
                <option value="pull">Guesty → ARK OS only</option>
                <option value="both">Both ways</option>
              </select>
              <span className="hint">
                Coming in: reservations become stays, guests join the CRM. Both ways also blocks the nights of stays booked
                here on the Guesty calendar, so Airbnb and Booking.com can’t take them.
              </span>
            </div>
            <div className="fld">
              <label htmlFor="gy-det">Home details</label>
              <label className="check" style={{ marginTop: 8 }}>
                <input id="gy-det" type="checkbox" name="sync_details" defaultChecked={i.sync_details} />
                Copy rate, sleeps, rooms, minimum nights and check-in times from Guesty
              </label>
              <span className="hint">Onto linked homes, at each sync. Photos, descriptions and amenities stay as they are.</span>
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
                    run(disconnectGuesty);
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
            <h2>Homes</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Which home each Guesty listing is. Reservations for a listing without a home are left out until it’s
              linked. The homes imported from the Guesty booking site were linked already.
            </p>
          </div>
        </div>
        {listings.length === 0 ? (
          <p className="muted">No listings yet. Connect, then Sync now.</p>
        ) : (
          <ul className="integ-map">
            {listings.map((l) => {
              const lot = lotOf.get(l.id);
              const details = [
                l.accommodates ? `sleeps ${l.accommodates}` : null,
                l.bedrooms !== null ? `${l.bedrooms} bed${l.bedrooms === 1 ? "" : "s"}` : null,
                rate(l),
                l.min_nights && l.min_nights > 1 ? `${l.min_nights}-night minimum` : null,
                !l.active ? "inactive in Guesty" : !l.listed ? "unlisted in Guesty" : null,
              ].filter(Boolean);
              return (
                <li key={l.id} className={lot ? "" : "unlinked"}>
                  <div className="who">
                    <b>{l.nickname && l.nickname !== l.title ? `${l.nickname} · ${l.title}` : l.title}</b>
                    <span className="muted">{details.join(" · ") || "—"}</span>
                  </div>
                  {canEdit ? (
                    <select
                      aria-label={`Home for ${l.title}`}
                      value={lot?.id ?? ""}
                      disabled={pending}
                      onChange={(e) => run(() => mapGuestyListing(l.id, e.target.value || null))}
                    >
                      <option value="">Not linked</option>
                      {lots.map((x) => (
                        <option key={x.id} value={x.id}>
                          {lotTitle(x)}
                          {x.name ? ` (${x.code})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{lot ? lotTitle(lot) : "Not linked"}</span>
                  )}
                  {lot && (
                    <Link className="btn sm" href={`/hospitality/${lot.id}`}>
                      Open
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-h">
          <div>
            <h2>Webhook from Guesty</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              So a booking on Airbnb or Booking.com shows in Hospitality within a minute instead of at the daily sync.
              “Register in Guesty” sets it up from here (and signs it). Or add it yourself in Guesty → Settings →
              Integrations → Webhooks, for the events reservation.created.v2 and reservation.updated.v2.
            </p>
          </div>
        </div>
        {!webhookReady && (
          <p className="note">
            The webhook needs SUPABASE_SERVICE_ROLE_KEY set on the server. Until then, the daily sync and Sync now still
            bring reservations in.
          </p>
        )}
        <div className="fld">
          <label htmlFor="gy-wh">Address</label>
          <div className="integ-copy">
            <input id="gy-wh" readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn" onClick={copy}>
              Copy
            </button>
          </div>
          <span className="hint">
            {i.webhook_id
              ? `Registered in Guesty${signed ? " and signed" : ""}. The key in the address is what tells us it’s Guesty; keep it out of screenshots.`
              : "The key in the address is what tells us it’s Guesty. Keep it out of screenshots."}
          </span>
        </div>
        {canEdit && (
          <div className="camp-actions" style={{ marginTop: 0 }}>
            {connected && !i.webhook_id && (
              <button type="button" className="btn sm primary" disabled={pending} onClick={() => run(() => registerGuestyWebhook(webhookUrl))}>
                Register in Guesty
              </button>
            )}
            <button type="button" className="btn sm" disabled={pending} onClick={() => run(rotateGuestyWebhookKey)}>
              New address
            </button>
          </div>
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
                <span className="tag-sm">{e.direction === "out" ? "→ Guesty" : "← Guesty"}</span>
                <span className="what">{e.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
