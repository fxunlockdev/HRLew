import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsListEditor } from "@/components/settings/settings-list-editor";

export const metadata = { title: "Settings · HR OS" };

const LISTS = [
  { key: "candidate_status", label: "Candidate statuses" },
  { key: "client_status", label: "Client statuses" },
  { key: "bd_stage", label: "BD stages" },
  { key: "job_status", label: "Job statuses" },
  { key: "pipeline_stage", label: "Pipeline stages" },
  { key: "interview_status", label: "Interview statuses" },
  { key: "placement_status", label: "Placement statuses" },
  { key: "candidate_source", label: "Candidate sources" },
  { key: "bd_source", label: "BD sources" },
];

export default async function SettingsPage() {
  await requirePermission("settings", "view");
  const supabase = await getSupabaseServerClient();
  const { data: rows } = await supabase.from("settings_lists").select("*").order("sort_order");

  return (
    <>
      <PageHeader title="Settings" description="Configure pipeline stages, statuses, and source values." />
      <Tabs defaultValue={LISTS[0].key}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {LISTS.map((l) => (
            <TabsTrigger key={l.key} value={l.key}>{l.label}</TabsTrigger>
          ))}
        </TabsList>
        {LISTS.map((l) => (
          <TabsContent key={l.key} value={l.key}>
            <SettingsListEditor
              listKey={l.key}
              rows={(rows ?? []).filter((r: any) => r.list_key === l.key) as any}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
