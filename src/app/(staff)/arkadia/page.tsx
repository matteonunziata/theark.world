import type { Metadata } from "next";
import { requireSchool } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { StudentsView } from "./students-view";

export const metadata: Metadata = { title: "Arkadia" };

export default async function ArkadiaPage() {
  const { supabase } = await requireSchool();
  const [{ data: students }, { data: updates }] = await Promise.all([
    supabase.from("students").select("*").order("name"),
    supabase
      .from("student_updates")
      .select("student_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const last = new Map<string, string>();
  for (const u of updates ?? []) if (!last.has(u.student_id)) last.set(u.student_id, u.created_at);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Arkadia</h1>
          <p className="lede">
            The school at The ARK. Every student, how they’re growing, and the
            updates their families see.
          </p>
        </div>
      </div>
      <StudentsView
        students={(students ?? []).map((s) => ({ ...s, last_update: last.get(s.id) ?? null }))}
        today={todayIn()}
      />
    </div>
  );
}
