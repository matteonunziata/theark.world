import type { Metadata } from "next";
import { Avatar } from "@/components/avatar";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Members" };

export default async function PortalMembers() {
  const { supabase } = await getViewer();
  const { data } = await supabase.rpc("member_directory");
  const list = data ?? [];
  return !list.length ? (
    <div className="empty">
      <p>The directory fills in as members join.</p>
    </div>
  ) : (
    <>
      <p className="gate-note">
        {list.length} {list.length === 1 ? "member" : "members"}. Say hi at the
        next farm dinner.
      </p>
      <div className="dir">
        {list.map((m) => (
          <div className="mcard" key={m.id}>
            <Avatar name={m.name} color="var(--leaf)" />
            <h3>{m.name}</h3>
          </div>
        ))}
      </div>
    </>
  );
}
