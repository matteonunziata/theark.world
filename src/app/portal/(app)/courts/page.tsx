import { redirect } from "next/navigation";

/** Courts live under Schedule now; old links still work. */
export default async function PortalCourtsPage({ searchParams }: PageProps<"/portal/courts">) {
  const { date } = await searchParams;
  redirect(`/portal/schedule?tab=courts${typeof date === "string" ? `&date=${encodeURIComponent(date)}` : ""}`);
}
