import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage() {
  const { supabase, staff } = await requireStaff("settings");
  const { data: org } = await supabase.from("org_settings").select("*").single();
  return <OrgForm org={org} canEdit={staff.role === "admin"} />;
}
