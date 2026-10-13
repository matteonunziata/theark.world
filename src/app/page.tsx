import { redirect } from "next/navigation";
import { getRoleAccess, getViewer } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const { user, staff, portalId, stewardId } = await getViewer();
  // One sign-in: the email decides who someone is. More than one place, they choose.
  const places = [staff, portalId, stewardId].filter(Boolean).length;
  if (places > 1 && !staff) redirect("/choose");
  if (staff) redirect(homeFor(staff.role, await getRoleAccess()));
  if (portalId) redirect("/portal");
  if (stewardId) redirect("/steward");
  redirect(user ? "/no-access" : "/login");
}
