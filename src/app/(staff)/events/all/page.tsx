import { redirect } from "next/navigation";

// The old combined list, split into Classes, Events and Experiences.
export default function AllOfferingsPage() {
  redirect("/events/classes");
}
