import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StaffForm } from "@/components/staff/staff-form";
import { hasPermission } from "@/lib/rbac";

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("staff", "view");
  const supabase = await getSupabaseServerClient();
  const [{ data: staff }, { data: managers }, { data: profiles }] = await Promise.all([
    supabase.from("staff").select("*").eq("id", id).maybeSingle(),
    supabase.from("staff").select("id, full_name").order("full_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  if (!staff) notFound();

  return (
    <>
      <PageHeader
        title={staff.full_name}
        description={[staff.designation, staff.department].filter(Boolean).join(" · ")}
        actions={<Button asChild variant="outline"><Link href="/staff">← Back</Link></Button>}
      />
      <StaffForm
        mode="edit"
        staff={staff as any}
        managers={managers ?? []}
        profiles={profiles ?? []}
        canEditSalary={hasPermission(ctx.profile, ctx.permissions, "staff", "edit_salary") || ctx.profile.role?.name === "admin"}
      />
    </>
  );
}
