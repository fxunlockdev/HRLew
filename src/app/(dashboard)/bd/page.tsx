import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BdKanban } from "@/components/bd/bd-kanban";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Business Development · HR OS" };

export default async function BdPage() {
  const { profile, permissions } = await requireAuth();
  const supabase = await getSupabaseServerClient();
  const [stages, { data: leads }] = await Promise.all([
    getSettingsList("bd_stage"),
    supabase
      .from("bd_leads")
      .select("id, company_name, contact_name, owner_id, stage, expected_value, next_follow_up_at, created_at, owner:profiles!bd_leads_owner_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <>
      <PageHeader
        title="Business Development"
        description="Pipeline of prospective clients. Drag leads to update their stage."
        actions={
          hasPermission(profile, permissions, "bd", "create") && (
            <Button asChild>
              <Link href="/bd/new"><Plus className="h-4 w-4" /> New lead</Link>
            </Button>
          )
        }
      />
      <BdKanban rows={(leads ?? []) as any} stages={stages} />
    </>
  );
}
