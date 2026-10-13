import Link from "next/link";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
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
  const { stages, leads } = await withProfile(profile.id, async (trx) => ({
    stages: await getSettingsList(trx, "bd_stage"),
    leads: await trx
      .selectFrom("bd_leads")
      .select((eb) => [
        "id",
        "company_name",
        "contact_name",
        "owner_id",
        "stage",
        "expected_value",
        "next_follow_up_at",
        "created_at",
        jsonObjectFrom(
          eb
            .selectFrom("profiles")
            .select("profiles.full_name")
            .whereRef("profiles.id", "=", "bd_leads.owner_id"),
        ).as("owner"),
      ])
      .orderBy("created_at", "desc")
      .limit(500)
      .execute(),
  }));

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
      <BdKanban rows={leads} stages={stages} />
    </>
  );
}
