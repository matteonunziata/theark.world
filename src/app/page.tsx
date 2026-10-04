import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const { user, staff, memberId } = await getViewer();
  if (staff) redirect(homeFor(staff.role));
  if (memberId) redirect("/portal");
  redirect(user ? "/no-access" : "/login");
}
