import type { Metadata } from "next";
import { reason, sharedInterests, suggestions } from "@/lib/connect";
import { loadPortal } from "@/lib/portal";
import { PeopleFilter } from "./people-filter";

export const metadata: Metadata = { title: "People" };

export default async function People() {
  const p = await loadPortal();
  const { data } = await p.supabase.rpc("member_directory");
  const people = (data ?? []).filter((x) => !x.is_me);
  const cityName = (id: string | null) => p.cities.find((c) => c.id === id)?.name;
  const sugg = suggestions(people, p.me, p.city?.id ?? null, 6);
  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 40, margin: 0 }}>People</h1>
          <p>The members of The ARK, and who’s around {p.city ? `in ${p.city.name}` : "right now"}.</p>
        </div>
      </div>
      <PeopleFilter
        cityId={p.city?.id ?? null}
        cityName={p.city?.name ?? ""}
        canMessage={!!p.me}
        suggested={sugg.map((s) => ({ id: s.p.id, why: reason(s, p.city?.name) }))}
        people={people.map((x) => ({
          ...x,
          cityName: cityName(x.city_id),
          shared: sharedInterests(p.me?.interests ?? [], x.interests),
        }))}
        meHasProfile={!!p.me?.interests.length}
      />
    </>
  );
}
