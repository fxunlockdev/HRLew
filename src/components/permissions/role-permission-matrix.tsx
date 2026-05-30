import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";

interface Role { id: string; name: string; description: string | null }
interface Permission { id: string; module: string; action: string; description: string | null }
interface Grant { role_id: string; permission_id: string }

export function RolePermissionMatrix({ roles, permissions, grants }: { roles: Role[]; permissions: Permission[]; grants: Grant[] }) {
  const has = (roleId: string, permId: string) =>
    grants.some((g) => g.role_id === roleId && g.permission_id === permId);

  const byModule = new Map<string, Permission[]>();
  permissions.forEach((p) => {
    if (!byModule.has(p.module)) byModule.set(p.module, []);
    byModule.get(p.module)!.push(p);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Effective grants</CardTitle>
        <p className="text-xs text-muted-foreground">
          Read-only view. To customize a role, edit role_permissions in Supabase (or via API).
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="p-2 text-center capitalize">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(byModule.entries()).map(([module, perms]) => (
              <Fragment key={module}>
                <tr>
                  <td colSpan={roles.length + 1} className="bg-slate-50 px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    {module}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-2">
                      <span className="font-mono text-xs">{p.action}</span>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    </td>
                    {roles.map((r) => (
                      <td key={r.id} className="p-2 text-center">
                        {has(r.id, p.id) ? <Check className="h-4 w-4 mx-auto text-emerald-600" /> : <X className="h-4 w-4 mx-auto text-slate-300" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
