import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalHead } from "@/components/portal-head";
import { getViewer } from "@/lib/auth";
import { EventDetails } from "../../event-details";
import { loadEvent } from "../../load";

type Props = PageProps<"/e/[id]/[[...date]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getViewer();
  const { data } = await supabase.from("offerings").select("title, description, short_description").eq(/^[0-9a-f]{8}-/i.test(id) ? "id" : "slug", id).maybeSingle();
  return data
    ? { title: data.title, description: data.short_description ?? data.description ?? undefined }
    : { title: "Event" };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { id, date } = await params;
  const { qr } = await searchParams;
  const picked = date?.[0] ?? null;
  const { event: ev, staff, memberId, orgName } = await loadEvent(id, picked);
  // Scanned from a class poster: members-only classes are hidden until
  // sign-in, so go straight there and come back to book.
  if (!ev && qr && !staff && !memberId) redirect(`/portal/login?next=/e/${id}`);
  const head = (
    <PortalHead
      name={orgName}
      sub="Classes and events"
      link={
        staff
          ? { href: "/events", label: "Staff view" }
          : memberId
            ? { href: "/portal", label: "Sign in" }
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
