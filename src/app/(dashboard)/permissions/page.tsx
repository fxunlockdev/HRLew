import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserRoleEditor } from "@/components/permissions/user-role-editor";
import { RolePermissionMatrix } from "@/components/permissions/role-permission-matrix";

export const metadata = { title: "Permissions · HR OS" };

export default async function PermissionsPage() {
  await requirePermission("rbac", "view");
  const supabase = await getSupabaseServerClient();
  const [
    { data: profiles },
    { data: roles },
    { data: permissions },
    { data: rolePerms },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, status, role_id, last_seen_at, created_at, role:roles(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("id, name, description").order("name"),
    supabase.from("permissions").select("id, module, action, description").order("module").order("action"),
    supabase.from("role_permissions").select("role_id, permission_id"),
  ]);

  return (
    <>
      <PageHeader
        title="Permissions"
        description="Manage user roles and review what each role can do."
      />
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users ({profiles?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="matrix">Role × Permission matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UserRoleEditor profiles={(profiles ?? []) as any} roles={(roles ?? []) as any} />
        </TabsContent>
        <TabsContent value="matrix">
          <RolePermissionMatrix
            roles={(roles ?? []) as any}
            permissions={(permissions ?? []) as any}
            grants={(rolePerms ?? []) as any}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
