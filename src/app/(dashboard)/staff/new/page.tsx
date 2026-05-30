import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StaffForm } from "@/components/staff/staff-form";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Add staff · HR OS" };

export default async function NewStaff() {
  const ctx = await requirePermission("staff", "create");
  const supabase = await getSupabaseServerClient();
  const [{ data: managers }, { data: profiles }] = await Promise.all([
    supabase.from("staff").select("id, full_name").order("full_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  return (
    <>
      <PageHeader title="Add staff member" />
      <StaffForm
        mode="create"
        managers={managers ?? []}
        profiles={profiles ?? []}
        canEditSalary={hasPermission(ctx.profile, ctx.permissions, "staff", "edit_salary") || ctx.profile.role?.name === "admin"}
      />
    </>
  );
}
