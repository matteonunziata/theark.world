import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const { user, staff, memberId, stewardId } = await getViewer();
  // One sign-in: the email decides who someone is. More than one place, they choose.
  const places = [staff, memberId, stewardId].filter(Boolean).length;
  if (places > 1 && !staff) redirect("/choose");
  if (staff) redirect(homeFor(staff.role));
  if (memberId) redirect("/portal");
  if (stewardId) redirect("/steward");
  redirect(user ? "/no-access" : "/login");
}
