import type { Metadata } from "next";
import { OfferingsList } from "../list-page";

export const metadata: Metadata = { title: "Classes" };

export default function ClassesPage() {
  return <OfferingsList kinds={["class"]} />;
}
