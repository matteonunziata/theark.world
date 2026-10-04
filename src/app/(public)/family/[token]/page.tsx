import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { firstName, schoolPhoto } from "@/lib/school";

export const metadata: Metadata = {
  title: "Arkadia",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Page = {
  name: string;
  preferred_name: string | null;
  group_name: string | null;
  photo_path: string | null;
  about: string | null;
  updates: { id: string; body: string; photo_path: string | null; created_at: string; author: string | null }[];
};

/** What a family sees: the profile and the updates teachers chose to share. */
export default async function FamilyPage({ params }: PageProps<"/family/[token]">) {
  const { token } = await params;
  const { supabase } = await getViewer();
  const { data } = await supabase.rpc("student_page", { p_token: token });
  const s = data as Page | null;
  if (!s) notFound();
  const photo = schoolPhoto(s.photo_path);
  const first = firstName(s);

  return (
    <main className="family">
      <header className="family-top">
        <Logo tone="dark" height={30} />
        <span>Arkadia</span>
      </header>
      <section className="family-hero">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={first} />
        ) : (
          <span className="ph" aria-hidden="true">{first.slice(0, 1)}</span>
        )}
        <h1>{s.preferred_name || s.name}</h1>
        {s.group_name && <p className="grp">{s.group_name}</p>}
        {s.about && <p className="about">{s.about}</p>}
      </section>
      <section className="family-feed" aria-label={`Updates about ${first}`}>
        <h2>From school</h2>
        {s.updates.length ? (
          s.updates.map((u) => (
            <article key={u.id}>
              <time dateTime={u.created_at}>{fmtDate(u.created_at.slice(0, 10))}</time>
              <p>{u.body}</p>
              {u.photo_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={schoolPhoto(u.photo_path)!} alt="" loading="lazy" />
              )}
              {u.author && <span className="by">{u.author}</span>}
            </article>
          ))
        ) : (
          <p className="none">
            Nothing shared yet. Updates from {first}’s teachers will appear here.
          </p>
        )}
      </section>
      <footer className="family-foot">
        This page is private to {first}’s family. Please don’t share the link.
      </footer>
    </main>
  );
}
