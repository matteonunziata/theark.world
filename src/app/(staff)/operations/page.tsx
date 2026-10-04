import type { Metadata } from "next";
import { todayIn } from "@/lib/dates";
import { loadTasks } from "./data";
import { TasksView } from "./tasks-view";

export const metadata: Metadata = { title: "Operations" };

export default async function OpsBoard() {
  return <TasksView view="board" today={todayIn()} {...await loadTasks()} />;
}
