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
