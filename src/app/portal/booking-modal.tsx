"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { eventForModal } from "@/app/(public)/e/actions";
import { EventDetails } from "@/app/(public)/e/event-details";

type Loaded = Awaited<ReturnType<typeof eventForModal>>;
type Target = { id: string; date: string | null };

const Ctx = createContext<((t: Target) => void) | null>(null);

/** Classes and events open in a modal over the portal instead of a new page. */
export function BookingModalProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const booked = useRef(false);
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!target) return;
    let live = true;
    eventForModal(target.id, target.date)
      .then((r) => live && setData(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [target]);

  const open = (t: Target) => {
    setData(null);
    setFailed(false);
    booked.current = false;
    setTarget(t);
    ref.current?.showModal();
  };
  const onClose = () => {
    setTarget(null);
    // Spots left and "My bookings" change after a booking.
    if (booked.current) router.refresh();
  };

  return (
    <Ctx.Provider value={open}>
      {children}
      <dialog
        ref={ref}
        className="book-modal"
        aria-label="Book"
        onClose={onClose}
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      >
        <button type="button" className="book-x" aria-label="Close" onClick={() => ref.current?.close()}>
          ×
        </button>
        <div className="book-body">
          {failed ? (
            <div className="empty">
              <h2>Couldn’t load this</h2>
              <p>Check your connection and try again.</p>
            </div>
          ) : !target || !data ? (
            <div className="book-loading" aria-live="polite">Loading…</div>
          ) : data.event ? (
            <EventDetails
              key={`${target.id}-${target.date}`}
              ev={data.event}
              date={target.date}
              isMember={data.isMember}
              compact
              onBooked={() => {
                booked.current = true;
              }}
            />
          ) : (
            <div className="empty">
              <h2>This isn’t available</h2>
              <p>It may have been removed or rescheduled.</p>
            </div>
          )}
        </div>
      </dialog>
    </Ctx.Provider>
  );
}

/** A link to a class or event that opens the booking modal. Cmd/ctrl-click
 * still opens the full page in a new tab. */
export function EventLink({
  id,
  date,
  className,
  children,
}: {
  id: string;
  date?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const open = useContext(Ctx);
  const href = date ? `/e/${id}/${date}` : `/e/${id}`;
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (!open || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        open({ id, date: date ?? null });
      }}
    >
      {children}
    </a>
  );
}
