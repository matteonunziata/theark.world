import type { Metadata } from "next";
import { PortalHead } from "@/components/portal-head";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/** The unsubscribe link in every marketing email. Asks first, because mail
 * scanners open links on their own. */
export default async function Unsubscribe({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  return (
    <>
      <PortalHead sub="Santa Teresa, Costa Rica" />
      <div className="p-body">
        <div className="empty">
          <UnsubscribeButton id={id} />
        </div>
      </div>
    </>
  );
}
