import { initials } from "@/components/avatar";
import { avatarColor } from "@/lib/connect";
import { avatarUrl } from "@/lib/covers";

export type Attendee = { id: string; name: string; photo_path: string | null; is_me: boolean };

/** Members who are booked into one date, with how many others are coming. */
export function Going({ list, taken }: { list: Attendee[]; taken: number }) {
  const others = Math.max(0, taken - list.length);
  if (!list.length && !others) return null;
  const names = list.map((a) => (a.is_me ? "you" : a.name.split(/\s+/)[0]));
  const text =
    names.length === 0
      ? `${others} going`
      : `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}${others ? ` and ${others} more` : ""} going`;
  return (
    <div className="ev-going" title={list.map((a) => a.name).join(", ")}>
      <span className="avs">
        {list.slice(0, 5).map((a) => {
          const src = avatarUrl(a.photo_path);
          return (
            <span key={a.id} className="av" style={{ background: avatarColor(a.id) }} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src ? <img src={src} alt="" /> : initials(a.name)}
            </span>
          );
        })}
      </span>
      <span>{text.charAt(0).toUpperCase() + text.slice(1)}</span>
    </div>
  );
}
