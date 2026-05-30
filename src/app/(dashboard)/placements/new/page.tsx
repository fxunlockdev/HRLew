import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { PlacementForm } from "@/components/placements/placement-form";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "New placement · HRLew" };

export default async function NewPlacementPage() {
  const ctx = await requirePermission("placements", "create");
  const supabase = await getSupabaseServerClient();
  const [statuses, { data: candidates }, { data: clients }, { data: jobs }, { data: recruiters }] = await Promise.all([
    getSettingsList("placement_status"),
    supabase.from("candidates").select("id, full_name").order("full_name").limit(500),
    supabase.from("clients").select("id, name").order("name").limit(500),
    supabase.from("job_requirements").select("id, title").order("title").limit(500),
    supabase.from("profiles").select("id, full_name").eq("status", "active"),
  ]);
  return (
    <>
      <PageHeader title="New placement" description="Records a successful hire and unlocks revenue tracking." />
      <PlacementForm
        mode="create"
        statuses={statuses}
        candidates={candidates ?? []}
        clients={clients ?? []}
        jobs={jobs ?? []}
        recruiters={recruiters ?? []}
        canEditFinancial={hasPermission(ctx.profile, ctx.permissions, "placements", "edit_financial") || ctx.profile.role?.name === "admin"}
      />
    </>
  );
}
