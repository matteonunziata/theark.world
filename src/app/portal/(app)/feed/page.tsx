import type { Metadata } from "next";
import { loadPortal } from "@/lib/portal";
import { FeedView } from "./feed-view";

export const metadata: Metadata = { title: "Feed" };

export default async function Feed() {
  const p = await loadPortal();
  const { data } = await p.supabase.rpc("feed", { p_limit: 150 });
  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 40, margin: 0 }}>Feed</h1>
          <p>Plans, finds, invitations. Who’s surfing at dawn, who has a spare seat.</p>
        </div>
      </div>
      <FeedView
        posts={data ?? []}
        cities={p.cities.map((c) => ({ id: c.id, name: c.name }))}
        cityId={p.city?.id ?? null}
        canDeleteAll={p.staff?.role === "admin"}
      />
    </>
  );
}
