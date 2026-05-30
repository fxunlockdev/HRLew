import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { BdLeadForm } from "@/components/bd/bd-lead-form";

export const metadata = { title: "New BD lead · HR OS" };

export default async function NewBdLeadPage() {
  await requirePermission("bd", "create");
  const supabase = await getSupabaseServerClient();
  const [stages, sources, { data: owners }] = await Promise.all([
    getSettingsList("bd_stage"),
    getSettingsList("bd_source"),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);
  return (
    <>
      <PageHeader title="New BD lead" />
      <BdLeadForm stages={stages} sources={sources} owners={owners ?? []} />
    </>
  );
}
