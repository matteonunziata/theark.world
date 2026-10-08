import type { Metadata } from "next";
import { OfferingsList } from "../list-page";

export const metadata: Metadata = { title: "Experiences" };

export default function ExperiencesPage() {
  return <OfferingsList kinds={["experience", "expedition"]} />;
}
