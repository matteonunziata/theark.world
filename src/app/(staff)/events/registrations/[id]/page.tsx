import { redirect } from "next/navigation";

/** Registrations moved into Event analytics; keep old links working. */
export default async function RegistrationsRedirect({ params }: PageProps<"/events/registrations/[id]">) {
  const { id } = await params;
  redirect(`/events/event-analytics/${id}`);
}
