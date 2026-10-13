import { requirePermission } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StaffForm } from "@/components/staff/staff-form";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Add staff · HR OS" };

export default async function NewStaff() {
  const ctx = await requirePermission("staff", "create");
  const { managers, profiles } = await withProfile(ctx.profile.id, async (trx) => ({
    managers: await trx
      .selectFrom("staff")
      .select(["id", "full_name"])
      .orderBy("full_name", "asc")
      .execute(),
    profiles: await trx
      .selectFrom("profiles")
      .select(["id", "full_name"])
      .orderBy("full_name", "asc")
      .execute(),
  }));
  return (
    <>
      <PageHeader title="Add staff member" />
      <StaffForm
        mode="create"
        managers={managers}
        profiles={profiles}
        canEditSalary={hasPermission(ctx.profile, ctx.permissions, "staff", "edit_salary") || ctx.profile.role?.name === "admin"}
      />
    </>
  );
}
