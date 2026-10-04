import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { OrgForm } from "./org-form";
import { SampleCard } from "./sample-card";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage() {
  const { supabase, staff } = await requireStaff("settings");
  const isAdmin = staff.role === "admin";
  const [{ data: org }, { count }] = await Promise.all([
    supabase.from("org_settings").select("*").single(),
    supabase.from("sample_records").select("record_id", { count: "exact", head: true }),
  ]);
  return (
    <>
      <OrgForm org={org} canEdit={isAdmin} />
      {isAdmin && <SampleCard loaded={!!count} />}
    </>
  );
}
