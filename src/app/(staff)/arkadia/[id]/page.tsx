import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireSchool } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { StudentView } from "./student-view";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({ params }: PageProps<"/arkadia/[id]">) {
  const { id } = await params;
  const { supabase, staff } = await requireSchool();
  const [{ data: s }, { data: family }, { data: updates }, { data: team }] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).maybeSingle(),
    supabase.from("student_guardians").select("*").eq("student_id", id).order("created_at"),
    supabase
      .from("student_updates")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("team_members").select("id, name"),
  ]);
  if (!s) notFound();
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <div className="page">
      <StudentView
        s={s}
        family={family ?? []}
        updates={(updates ?? []).map((u) => ({
          ...u,
          author: team?.find((t) => t.id === u.author_id)?.name ?? null,
        }))}
        familyUrl={`${origin}/family/${s.share_token}`}
        today={todayIn()}
        meId={staff.id}
        isAdmin={staff.role === "admin"}
      />
    </div>
  );
}
