import { addDays, fmtDate } from "@/lib/dates";

export const STATUSES = [
  ["backlog", "Backlog"],
  ["next", "Next up"],
  ["doing", "In progress"],
  ["review", "Review"],
  ["done", "Done"],
] as const;
export const PRIORITIES = [
  ["urgent", "Urgent"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
] as const;
export const TASK_KINDS = [
  ["task", "Task"],
  ["maintenance", "Maintenance"],
  ["purchase", "Purchase"],
  ["event", "Event prep"],
] as const;

export const statusName = (k: string) => STATUSES.find((s) => s[0] === k)?.[1] ?? "Backlog";
export const priName = (k: string) => PRIORITIES.find((s) => s[0] === k)?.[1] ?? "Medium";
export const kindLabel = (k: string) => TASK_KINDS.find((s) => s[0] === k)?.[1] ?? "Task";
const priRank = (k: string) => PRIORITIES.findIndex((p) => p[0] === k);

export function dueClass(d: string | null, status: string, today: string) {
  if (!d || status === "done") return "";
  if (d < today) return "late";
  if (d <= addDays(today, 2)) return "soon";
  return "";
}

export function dueLabel(d: string | null, today: string) {
  if (!d) return "";
  if (d === today) return "Today";
  if (d === addDays(today, 1)) return "Tomorrow";
  const s = fmtDate(d, { month: "short", day: "numeric" });
  return d < today ? `${s}, overdue` : s;
}

export function sortTasks<
  T extends { priority: string; due_date: string | null; created_at: string },
>(arr: T[]) {
  return [...arr].sort(
    (a, b) =>
      priRank(a.priority) - priRank(b.priority) ||
      (a.due_date ?? "9").localeCompare(b.due_date ?? "9") ||
      a.created_at.localeCompare(b.created_at),
  );
}

/** Roles that see money on a task and can ask for a budget (the lead of its division, or an admin). */
export const MONEY_ROLES = ["admin", "lead", "community_manager"];
export const seesTaskMoney = (role: string) => MONEY_ROLES.includes(role);

export function fmtMinutes(min: number | null | undefined) {
  const m = Math.max(0, Math.round(min ?? 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

/** "08:30:00" → "8:30 am". */
export function fmtStart(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Hours typed as "1.5", "1,5" or "1:30" → whole minutes (null if it isn't a time). */
export function parseHours(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  const n = hm ? Number(hm[1]) * 60 + Number(hm[2]) : Math.round(Number(s) * 60);
  return Number.isFinite(n) && n >= 1 && n <= 1440 ? n : null;
}

export type FlowStep = "clock_in" | "before" | "work" | "after" | "materials" | "clock_out";
export const FLOW_STEPS: [FlowStep, string][] = [
  ["clock_in", "Clock in"],
  ["before", "Before photos"],
  ["work", "Do the work"],
  ["after", "After photos"],
  ["materials", "Materials"],
  ["clock_out", "Clock out"],
];

/** Where someone is in the on-site flow: not clocked in, or what's still missing since they did. */
export function flowStep(open: boolean, before: number, after: number): FlowStep {
  if (!open) return "clock_in";
  if (!before) return "before";
  if (!after) return "work";
  return "clock_out";
}
