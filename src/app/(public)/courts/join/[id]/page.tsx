import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { getViewer } from "@/lib/auth";
import { courtMoney, levelRange, type PriceItem, sportName } from "@/lib/courts";
import { fmtDate, fmtTime, todayIn } from "@/lib/dates";
import { stripeReady } from "@/lib/stripe";
import { JoinForm } from "./join-form";
import "../../courts.css";
import { SiteNavBar } from "../../../site/site-nav";

export const metadata: Metadata = { title: { absolute: "Join a match — The ARK" }, robots: { index: false } };

type Info = {
  booking_id: string;
  court: string;
  sport: string;
  date: string;
  start_time: string;
  end_time: string;
  host: string;
  open_match: boolean;
  private_pay: "whole" | "split" | null;
  level_min: number | null;
  level_max: number | null;
  spots: number;
  players: number;
  currency: string;
  share: number;
  closed: boolean;
  full: boolean;
};

/** The join page. The id is an open match's id from the list, or a join link's token (private or open). */
export default async function JoinMatchPage({ params }: PageProps<"/courts/join/[id]">) {
  const { id } = await params;
  const { supabase, memberId } = await getViewer();
  const [{ data }, { data: prices }, { data: org }, { data: me }] = await Promise.all([
    supabase.rpc("court_join_info", { p_key: id }),
    supabase.rpc("public_court_prices"),
    supabase.rpc("public_org").maybeSingle(),
    memberId ? supabase.rpc("my_member_profile").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const m = data as Info | null;
  const today = todayIn(org?.timezone ?? "America/Costa_Rica");
  const equipment = ((prices ?? []) as PriceItem[]).filter((p) => p.kind === "equipment");

  return (
    <main className="crts">
      <ArkFonts />
      <SiteNavBar here="/courts" />
      <div className="crts-card">
        {!m || m.closed ? (
          <>
            <span className="crts-state bad">Not open</span>
            <h1>This match isn’t open any more</h1>
            <p className="muted">It may be cancelled or already played. There may be another one to join.</p>
            <div className="acts">
              <Link className="btn solid" href="/courts#matches">See open matches</Link>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">{m.open_match ? "Open match" : "Private match"} · {sportName(m.sport)}</p>
            <h1>{m.court}</h1>
            <p className="muted">
              {m.date === today ? "Today" : fmtDate(m.date, { weekday: "long", month: "long", day: "numeric" })},{" "}
              {fmtTime(m.start_time)}–{fmtTime(m.end_time)} · hosted by {m.host}
            </p>
            <div className="crts-rows">
              {m.open_match && (
                <div>
                  <span>Level</span>
                  <span>{levelRange(m.level_min, m.level_max)}</span>
                </div>
              )}
              <div>
                <span>Players</span>
                <span>
                  {m.players} of {m.spots} in, {Math.max(0, m.spots - m.players)} spot{m.spots - m.players === 1 ? "" : "s"} left
                </span>
              </div>
              <div>
                <span>{m.share > 0 ? "Your share" : "To pay"}</span>
                <span>{m.share > 0 ? `${courtMoney(m.share, m.currency)} (VAT included)` : `Nothing: ${m.host} pays for the court`}</span>
              </div>
            </div>
            {m.full ? (
              <p className="muted">This match is full.</p>
            ) : (
              <JoinForm
                joinKey={id}
                openMatch={m.open_match}
                levelMin={Number(m.level_min ?? 0)}
                levelMax={Number(m.level_max ?? 7)}
                share={Number(m.share)}
                currency={m.currency}
                equipment={equipment}
                me={me ? { name: me.name ?? "", email: me.email ?? "", phone: me.phone ?? "" } : null}
                online={stripeReady()}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
