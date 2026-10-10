import { fmtDate } from "@/lib/dates";

export const FREQS = [
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["yearly", "Yearly"],
  ["once", "Once"],
] as const;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const ordinal = (n: number) => {
  const v = n % 100;
  return `${n}${["th", "st", "nd", "rd"][(v - 20) % 10] ?? ["th", "st", "nd", "rd"][v] ?? "th"}`;
};

type Rule = {
  freq: string;
  every: number;
  weekday: number | null;
  month_day: number | null;
  start_date: string;
};

/** "Every Monday", "Every 2 weeks on Friday", "Monthly on the 15th", "Once on Oct 12". */
export function describeService(s: Rule) {
  const n = s.every;
  switch (s.freq) {
    case "weekly": {
      const day = WEEKDAYS[s.weekday ?? 0];
      return n === 1 ? `Every ${day}` : `Every ${n} weeks on ${day}`;
    }
    case "monthly": {
      const d = ordinal(s.month_day ?? 1);
      return n === 1 ? `Monthly on the ${d}` : `Every ${n} months on the ${d}`;
    }
    case "yearly":
      return `${n === 1 ? "Every year" : `Every ${n} years`} on ${fmtDate(s.start_date, { month: "long", day: "numeric" })}`;
    default:
      return `Once on ${fmtDate(s.start_date, { month: "short", day: "numeric", year: "numeric" })}`;
  }
}
