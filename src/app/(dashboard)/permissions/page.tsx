import { requirePermission } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserRoleEditor } from "@/components/permissions/user-role-editor";
import { RolePermissionMatrix } from "@/components/permissions/role-permission-matrix";
import { CreateUserForm } from "@/components/permissions/create-user-form";

export const metadata = { title: "Permissions · HR OS" };

export default async function PermissionsPage() {
  const ctx = await requirePermission("rbac", "view");
  const canManage =
    hasPermission(ctx.profile, ctx.permissions, "rbac", "manage") ||
    ctx.profile.role?.name === "admin";

  const { profiles, roles, permissions, rolePerms } = await withProfile(
    ctx.profile.id,
    async (trx) => ({
      profiles: await trx
        .selectFrom("profiles")
        .select((eb) => [
          "profiles.id",
          "profiles.full_name",
          "profiles.email",
          "profiles.status",
          "profiles.role_id",
          "profiles.last_seen_at",
          "profiles.created_at",
          jsonObjectFrom(
            eb
              .selectFrom("roles")
              .select(["roles.id", "roles.name"])
              .whereRef("roles.id", "=", "profiles.role_id"),
          ).as("role"),
        ])
        .orderBy("profiles.created_at", "desc")
        .execute(),
      roles: await trx
        .selectFrom("roles")
        .select(["id", "name", "description"])
        .orderBy("name", "asc")
        .execute(),
      permissions: await trx
        .selectFrom("permissions")
        .select(["id", "module", "action", "description"])
        .orderBy("module", "asc")
        .orderBy("action", "asc")
        .execute(),
      rolePerms: await trx
        .selectFrom("role_permissions")
        .select(["role_id", "permission_id"])
        .execute(),
    }),
  );

  return (
    <>
      <PageHeader
        title="Permissions"
        description="Manage user roles and review what each role can do."
      />
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users ({profiles.length})</TabsTrigger>
          <TabsTrigger value="matrix">Role × Permission matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
          {canManage && <CreateUserForm roles={roles} />}
          <UserRoleEditor
            profiles={profiles}
            roles={roles}
            canManage={canManage}
            currentProfileId={ctx.profile.id}
          />
        </TabsContent>
        <TabsContent value="matrix">
          <RolePermissionMatrix roles={roles} permissions={permissions} grants={rolePerms} />
        </TabsContent>
      </Tabs>
    </>
  );
}
