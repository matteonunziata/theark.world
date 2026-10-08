import { redirect } from "next/navigation";

// Classes and events now have a tab each. Kept because staff on join.theark.world
// reach the schedule through this path (see src/proxy.ts).
export default function AllOfferingsPage() {
  redirect("/events/classes");
}
