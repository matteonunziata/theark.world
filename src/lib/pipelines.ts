import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pipeline } from "@/lib/crm";
import type { Database } from "@/lib/database.types";

/** Every pipeline with its stages, in the order admins set. */
export async function getPipelines(
  supabase: SupabaseClient<Database>,
): Promise<Pipeline[]> {
  const [{ data: pipes }, { data: stages }] = await Promise.all([
    supabase.from("pipelines").select("key, name").order("position"),
    supabase.from("pipeline_stages").select("pipeline, key, label").order("position"),
  ]);
  return (pipes ?? []).map((p) => ({
    key: p.key,
    name: p.name,
    stages: (stages ?? [])
      .filter((s) => s.pipeline === p.key)
      .map((s) => [s.key, s.label] as [string, string]),
  }));
}
