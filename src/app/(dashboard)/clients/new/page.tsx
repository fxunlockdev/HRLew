import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "New client · HR OS" };

export default async function NewClientPage() {
  await requirePermission("clients", "create");
  const supabase = await getSupabaseServerClient();
  const [statuses, { data: profiles }] = await Promise.all([
    getSettingsList("client_status"),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  return (
    <>
      <PageHeader title="New client" />
      <ClientForm mode="create" statuses={statuses} owners={profiles ?? []} />
    </>
  );
}
