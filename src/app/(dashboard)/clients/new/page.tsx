import { withProfile } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "New client · HR OS" };

export default async function NewClientPage() {
  const { profile } = await requirePermission("clients", "create");

  const { statuses, owners } = await withProfile(profile.id, async (trx) => ({
    statuses: await getSettingsList(trx, "client_status"),
    owners: await trx
      .selectFrom("profiles")
      .select(["id", "full_name"])
      .where("status", "=", "active")
      .orderBy("full_name", "asc")
      .execute(),
  }));

  return (
    <>
      <PageHeader title="New client" />
      <ClientForm mode="create" statuses={statuses} owners={owners} />
    </>
  );
}
