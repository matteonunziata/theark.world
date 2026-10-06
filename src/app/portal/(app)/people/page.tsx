import type { Metadata } from "next";
import { reason, sharedInterests, suggestions } from "@/lib/connect";
import { loadPortal } from "@/lib/portal";
import { PeopleFilter } from "./people-filter";

export const metadata: Metadata = { title: "People" };

export default async function People() {
  const p = await loadPortal();
  const { data } = await p.supabase.rpc("member_directory");
  const people = (data ?? []).filter((x) => !x.is_me);
  const sugg = suggestions(people, p.me, 6);
  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="pv-h1">People</h1>
          <p>The members of The ARK. Say hello on WhatsApp to anyone who’s open to it.</p>
        </div>
      </div>
      <PeopleFilter
        meName={p.me?.name ?? p.staff?.name ?? null}
        suggested={sugg.map((s) => ({ id: s.p.id, why: reason(s) }))}
        people={people.map((x) => ({
          ...x,
          shared: sharedInterests(p.me?.interests ?? [], x.interests),
        }))}
        meHasProfile={!!(p.me?.interests.length || p.me?.cities.length)}
      />
    </>
  );
}
