"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { useDrawer } from "@/components/drawer";
import { tierColor } from "@/lib/crm";
import { dayLabel } from "@/lib/dates";
import { type Enrollment, MessageDrawer, type Sequence } from "../message-drawer";

type Item = {
  due: string;
  i: number;
  contact: { id: string; name: string; email: string | null; phone: string | null; tier: string | null };
  seq: Sequence;
  e: Enrollment;
};

export function QueueView({
  items,
  today,
  orgName,
  canEdit,
}: {
  items: Item[];
  today: string;
  orgName: string;
  canEdit: boolean;
}) {
  const drawer = useDrawer<Item>();
  return (
    <>
      <p className="lede" style={{ margin: "-10px 0 16px" }}>
        Messages that are due. Send them, then mark them sent so the next step
        lines up.
      </p>
      {!items.length ? (
        <div className="empty">
          <h2>Nothing due</h2>
          <p>
            Messages appear here on the day they’re due, based on who’s enrolled
            in which sequence.
          </p>
        </div>
      ) : (
        <div className="list">
          <div className="row head qrow">
            <span>Person</span>
            <span>Message</span>
            <span>Due</span>
            <span />
          </div>
          {items.map((it) => (
            <div className="row qrow static" key={`${it.e.id}-${it.i}`}>
              <span className="who">
                <Avatar name={it.contact.name} color={tierColor(it.contact.tier)} />
                <span>
                  <b>
                    <Link href={`/crm/contact/${it.contact.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {it.contact.name}
                    </Link>
                  </b>
                  <span>{it.seq.steps[it.i].channel === "whatsapp" ? "WhatsApp" : "Email"}</span>
                </span>
              </span>
              <span>
                <b style={{ fontWeight: 600 }}>{it.seq.name}</b>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>
                  Step {it.i + 1} of {it.seq.steps.length}
                </span>
              </span>
              <span className={`due ${it.due < today ? "late" : ""}`}>{dayLabel(it.due, today)}</span>
              <span className="acts">
                {canEdit && (
                  <button type="button" className="btn primary" onClick={() => drawer.openItem(it)}>
                    Open
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {drawer.item && (
        <MessageDrawer
          key={`${drawer.item.e.id}-${drawer.item.i}`}
          open={drawer.open}
          contact={drawer.item.contact}
          orgName={orgName}
          e={drawer.item.e}
          seq={drawer.item.seq}
          i={drawer.item.i}
          onClose={drawer.close}
        />
      )}
    </>
  );
}
