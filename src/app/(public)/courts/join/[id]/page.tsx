import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { courtMoney, levelRange, sportName } from "@/lib/courts";
import { fmtDate, fmtTime, todayIn } from "@/lib/dates";
import { stripeReady } from "@/lib/stripe";
import { JoinForm } from "./join-form";
import "../../courts.css";

export const metadata: Metadata = { title: { absolute: "Join an open match — The ARK" }, robots: { index: false } };

export default async function JoinMatchPage({ params }: PageProps<"/courts/join/[id]">) {
  const { id } = await params;
  const { supabase, memberId } = await getViewer();
  const [{ data: matches }, { data: org }, { data: me }] = await Promise.all([
    supabase.rpc("public_open_matches"),
    supabase.rpc("public_org").maybeSingle(),
    memberId ? supabase.rpc("my_member_profile").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const m = (matches ?? []).find((x) => x.booking_id === id);
  const today = todayIn(org?.timezone ?? "America/Costa_Rica");

  return (
    <main className="crts">
      <ArkFonts />
      <header className="crts-nav">
        <Link href="/courts" aria-label="The ARK courts">
          <Logo tone="dark" height={32} />
        </Link>
        <nav>
          <Link href="/courts" className="btn sm">All courts</Link>
        </nav>
      </header>
      <div className="crts-card">
        {!m ? (
          <>
            <span className="crts-state bad">Not open</span>
            <h1>This match isn’t open any more</h1>
            <p className="muted">It may be full, cancelled or already played. There may be another one to join.</p>
            <div className="acts">
              <Link className="btn solid" href="/courts#matches">See open matches</Link>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">Open match · {sportName(m.sport)}</p>
            <h1>{m.court}</h1>
            <p className="muted">
              {m.date === today ? "Today" : fmtDate(m.date, { weekday: "long", month: "long", day: "numeric" })},{" "}
              {fmtTime(m.start_time)}–{fmtTime(m.end_time)} · hosted by {m.host}
            </p>
            <div className="crts-rows">
              <div>
                <span>Level</span>
                <span>{levelRange(m.level_min, m.level_max)}</span>
              </div>
              <div>
                <span>Players</span>
                <span>
                  {m.players} of {m.spots} in, {m.spots - m.players} spot{m.spots - m.players === 1 ? "" : "s"} left
                </span>
              </div>
              <div>
                <span>Your share</span>
                <span>{courtMoney(m.share, m.currency)}</span>
              </div>
            </div>
            {m.players >= m.spots ? (
              <p className="muted">This match is full.</p>
            ) : (
              <JoinForm
                bookingId={m.booking_id}
                levelMin={Number(m.level_min ?? 0)}
                levelMax={Number(m.level_max ?? 7)}
                share={Number(m.share)}
                currency={m.currency}
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
