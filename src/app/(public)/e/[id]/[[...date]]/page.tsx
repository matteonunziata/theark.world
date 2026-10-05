import type { Metadata } from "next";
import Link from "next/link";
import { PortalHead } from "@/components/portal-head";
import { getViewer } from "@/lib/auth";
import { EventDetails } from "../../event-details";
import { loadEvent } from "../../load";

type Props = PageProps<"/e/[id]/[[...date]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getViewer();
  const { data } = await supabase.from("offerings").select("title, description").eq("id", id).maybeSingle();
  return data
    ? { title: data.title, description: data.description ?? undefined }
    : { title: "Event" };
}

export default async function EventPage({ params }: Props) {
  const { id, date } = await params;
  const picked = date?.[0] ?? null;
  const { event: ev, staff, memberId, orgName } = await loadEvent(id, picked);
  const head = (
    <PortalHead
      name={orgName}
      sub="Classes and events"
      link={
        staff
          ? { href: "/events", label: "Staff view" }
          : memberId
            ? { href: "/portal", label: "Members portal" }
            : { href: `/portal/login?next=/e/${id}`, label: "Member sign-in" }
      }
    />
  );

  if (!ev) {
    return (
      <>
        {head}
        <div className="p-body">
          <div className="empty">
            <h2>This isn’t available</h2>
            <p>
              It may have been removed, or it’s for members only.{" "}
              {!memberId && !staff && (
                <>
                  Members can <Link href={`/portal/login?next=/e/${id}`}>sign in</Link> to see it.
                </>
              )}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <div className="p-body">
        <Link className="ev-back" href={memberId ? "/portal" : "/"}>
          ← {memberId ? "Full schedule" : orgName}
        </Link>
        <EventDetails ev={ev} date={picked} isMember={!!memberId} />
      </div>
    </>
  );
}
