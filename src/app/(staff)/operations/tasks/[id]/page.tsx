import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isBudgetAdmin, requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { TaskPage } from "./task-page";

type Props = PageProps<"/operations/tasks/[id]">;

export const metadata: Metadata = { title: "Task" };

export default async function OpsTask({ params }: Props) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff("operations");
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) notFound();

  const { data: manages } = await supabase.rpc("can_manage_task", { t: id });
  const canManage = manages === true;

  const [subtasks, comments, time, photos, materials, team, lot, amenity, costs, requests, summary] = await Promise.all([
    supabase.from("task_subtasks").select("*").eq("task_id", id).order("created_at"),
    supabase.from("task_comments").select("*").eq("task_id", id).order("created_at"),
    supabase.from("task_time").select("*").eq("task_id", id).order("clock_in", { ascending: false }),
    supabase.from("task_photos").select("*").eq("task_id", id).order("created_at"),
    supabase.from("task_materials").select("*").eq("task_id", id).order("created_at"),
    supabase.from("team_members").select("id, name"),
    task.lot_id ? supabase.from("lots").select("id, code, name").eq("id", task.lot_id).maybeSingle() : Promise.resolve({ data: null }),
    task.amenity_id ? supabase.from("amenities").select("name").eq("id", task.amenity_id).maybeSingle() : Promise.resolve({ data: null }),
    canManage ? supabase.from("task_material_costs").select("material_id, amount") : Promise.resolve({ data: [] }),
    canManage ? supabase.from("task_budget_requests").select("*").eq("task_id", id).order("requested_at", { ascending: false }) : Promise.resolve({ data: [] }),
    canManage ? supabase.rpc("task_cost_summary", { p_task: id }) : Promise.resolve({ data: [] }),
  ]);

  const paths = (photos.data ?? []).map((p) => p.path);
  const signed = paths.length ? await supabase.storage.from("task-photos").createSignedUrls(paths, 3600) : { data: [] };
  const urls: Record<string, string> = {};
  for (const s of signed.data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;

  const costOf = new Map((costs.data ?? []).map((c) => [c.material_id, Number(c.amount)]));
  return (
    <TaskPage
      today={todayIn()}
      staffId={staff.id}
      canManage={canManage}
      canReview={isBudgetAdmin(staff)}
      // The old cost field on a property task is for leads and admins only.
      task={canManage ? task : { ...task, cost: null }}
      team={team.data ?? []}
      lotName={lot.data ? (lot.data.name ?? `Lot ${lot.data.code}`) : null}
      amenityName={amenity.data?.name ?? null}
      subtasks={subtasks.data ?? []}
      comments={comments.data ?? []}
      time={time.data ?? []}
      photos={(photos.data ?? []).map((p) => ({ ...p, url: urls[p.path] ?? null }))}
      materials={(materials.data ?? []).map((m) => ({ ...m, amount: costOf.get(m.id) ?? null }))}
      requests={requests.data ?? []}
      summary={summary.data?.[0] ?? null}
    />
  );
}
