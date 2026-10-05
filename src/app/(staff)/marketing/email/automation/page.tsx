import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { AutomationForm } from "./automation-form";

export const metadata: Metadata = { title: "Waitlist automation" };

export default async function AutomationPage() {
  const { supabase, staff } = await requireStaff("marketing");
  const [{ data: a }, { data: sends }] = await Promise.all([
    supabase.from("email_automations").select("*").eq("key", "waitlist").single(),
    supabase
      .from("email_sends")
      .select("automation_step, opened_at, clicked_at")
      .not("automation_step", "is", null)
      .eq("status", "sent"),
  ]);
  const stat = (step: string) => {
    const s = (sends ?? []).filter((x) => x.automation_step === step);
    return { sent: s.length, opened: s.filter((x) => x.opened_at).length, clicked: s.filter((x) => x.clicked_at).length };
  };
  return (
    <>
      <Link className="ev-back" href="/marketing/email">← Email</Link>
      {a && (
        <AutomationForm
          automation={a}
          welcome={stat("welcome")}
          followup={stat("followup")}
          isAdmin={staff.role === "admin"}
        />
      )}
    </>
  );
}
