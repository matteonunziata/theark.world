import type { Metadata } from "next";
import { todayIn } from "@/lib/dates";
import { loadTasks } from "../data";
import { TasksView } from "../tasks-view";

export const metadata: Metadata = { title: "Operations list" };

export default async function OpsList() {
  return <TasksView view="list" today={todayIn()} {...await loadTasks()} />;
}
