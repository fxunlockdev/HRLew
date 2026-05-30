import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { BdActivityFeed } from "@/components/bd/bd-activity-feed";
import { ConvertLeadButton } from "@/components/bd/convert-lead-button";
import { formatCurrency, formatDate, relativeTime } from "@/lib/utils";

export default async function BdLeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { data: lead } = await supabase
    .from("bd_leads")
    .select("*, owner:profiles!bd_leads_owner_id_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();

  const { data: activities } = await supabase
    .from("bd_activities")
    .select("*, author:profiles!bd_activities_author_id_fkey(full_name)")
    .eq("lead_id", id)
    .order("occurred_at", { ascending: false });

  return (
    <>
      <PageHeader
        title={lead.company_name}
        description={lead.display_id + (lead.industry ? ` · ${lead.industry}` : "")}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/bd">← Back</Link></Button>
            {!lead.converted_client_id && <ConvertLeadButton leadId={id} />}
            {lead.converted_client_id && (
              <Button asChild variant="outline">
                <Link href={`/clients/${lead.converted_client_id}`}>View client →</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lead.company_name}</CardTitle>
            <div className="mt-1"><StatusBadge label={lead.stage} /></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Contact" value={lead.contact_name} />
            <Row label="Email" value={lead.contact_email} />
            <Row label="Phone" value={lead.contact_phone} />
            <Row label="Industry" value={lead.industry} />
            <Row label="Source" value={lead.source} />
            <Row label="Owner" value={lead.owner?.full_name} />
            <Row label="Expected value" value={lead.expected_value ? formatCurrency(lead.expected_value) : null} />
            <Row label="Next follow-up" value={formatDate(lead.next_follow_up_at)} />
            <Row label="Added" value={relativeTime(lead.created_at)} />
            {lead.notes && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <BdActivityFeed leadId={id} activities={(activities ?? []) as any} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
