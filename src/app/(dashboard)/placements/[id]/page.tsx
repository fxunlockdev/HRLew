import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlacementForm } from "@/components/placements/placement-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export default async function PlacementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, permissions } = await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { data: p } = await supabase
    .from("placements")
    .select(
      "*, candidate:candidates(id, full_name), client:clients(id, name), job:job_requirements(id, title), recruiter:profiles!placements_recruiter_id_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [statuses, { data: candidates }, { data: clients }, { data: jobs }, { data: recruiters }] = await Promise.all([
    getSettingsList("placement_status"),
    supabase.from("candidates").select("id, full_name").order("full_name").limit(500),
    supabase.from("clients").select("id, name").order("name").limit(500),
    supabase.from("job_requirements").select("id, title").order("title").limit(500),
    supabase.from("profiles").select("id, full_name").eq("status", "active"),
  ]);
  const stat = statuses.find((s) => s.value === p.status);
  const canViewFinancial = hasPermission(profile, permissions, "placements", "view_financial") || profile.role?.name === "admin" || profile.role?.name === "manager";
  const canEditFinancial = hasPermission(profile, permissions, "placements", "edit_financial") || profile.role?.name === "admin";

  return (
    <>
      <PageHeader
        title={`${p.display_id} · ${p.candidate?.full_name}`}
        description={`${p.client?.name} · ${p.job?.title}`}
        actions={
          <Button asChild variant="outline"><Link href="/placements">← Back</Link></Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <div className="mt-1"><StatusBadge label={stat?.label ?? p.status} color={stat?.color} /></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Designation" value={p.offered_designation} />
            <Row label="Joining" value={formatDate(p.joining_date)} />
            <Row label="Recruiter" value={p.recruiter?.full_name} />
            {canViewFinancial && (
              <>
                <Row label="Offered CTC" value={formatCurrency(p.offered_ctc)} />
                <Row label="Billing %" value={p.billing_percentage ? `${p.billing_percentage}%` : null} />
                <Row label="Revenue" value={formatCurrency(p.placement_revenue)} />
                <Row label="Invoice" value={`${p.invoice_status} ${p.invoice_number ? `· ${p.invoice_number}` : ""}`.trim()} />
                <Row label="Payment" value={p.payment_status} />
              </>
            )}
            <Row label="Replacement until" value={formatDate(p.replacement_end_date)} />
          </CardContent>
        </Card>

        <PlacementForm
          mode="edit"
          placement={p as any}
          statuses={statuses}
          candidates={candidates ?? []}
          clients={clients ?? []}
          jobs={jobs ?? []}
          recruiters={recruiters ?? []}
          canEditFinancial={canEditFinancial}
        />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right capitalize">{value}</span>
    </div>
  );
}
