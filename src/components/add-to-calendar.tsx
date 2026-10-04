import { type CalEvent, googleCalendarUrl } from "@/lib/calendar";

/** Google Calendar link plus an .ics download for Apple and Outlook. */
export function AddToCalendar({ event, icsHref }: { event: CalEvent; icsHref: string }) {
  return (
    <div className="cal-links">
      <a className="btn" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
        Google Calendar
      </a>
      <a className="btn" href={icsHref}>
        Apple or Outlook
      </a>
    </div>
  );
}
