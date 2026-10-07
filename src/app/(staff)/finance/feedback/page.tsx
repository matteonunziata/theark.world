import type { Metadata } from "next";
import { requireBudgetAdmin } from "@/lib/auth";
import { FeedbackList } from "./feedback-list";

export const metadata: Metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  const { supabase } = await requireBudgetAdmin();
  const [{ data: feedback }, { data: divisions }] = await Promise.all([
    supabase.from("finance_feedback").select("*").order("created_at", { ascending: false }),
    supabase.from("divisions").select("id, name"),
  ]);
  return <FeedbackList feedback={feedback ?? []} divisions={divisions ?? []} />;
}
