"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Keeps the numbers current: refreshes when a booking changes, and once a minute as a fallback. */
export function LiveRefresh({ offeringId }: { offeringId: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const sb = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A booking writes its tickets a moment after itself; wait for both.
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 800);
    };
    const channel = sb
      .channel(`registrations-${offeringId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations", filter: `offering_id=eq.${offeringId}` }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "registration_items" }, bump)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const poll = setInterval(() => router.refresh(), 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      sb.removeChannel(channel);
    };
  }, [offeringId, router]);

  return (
    <span className="muted" style={{ fontSize: 13 }} title={live ? "Updates as bookings come in" : "Updates every minute"}>
      <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, marginRight: 6, background: live ? "var(--leaf)" : "var(--muted)" }} />
      {live ? "Live" : "Updating every minute"}
    </span>
  );
}
