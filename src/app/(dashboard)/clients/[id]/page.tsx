import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClientForm } from "@/components/clients/client-form";
import { ClientContacts } from "@/components/clients/client-contacts";
import { ClientNotes } from "@/components/clients/client-notes";
import { LinkedJobsList } from "@/components/clients/linked-jobs-list";
import { CompanyLogo } from "@/components/ui/company-logo";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, permissions } = await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  const [statuses, { data: owners }, { data: contacts }, { data: notes }, { data: jobs }, { data: placements }] =
    await Promise.all([
      getSettingsList("client_status"),
      supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
      supabase.from("client_contacts").select("*").eq("client_id", id).order("is_primary", { ascending: false }),
      supabase
        .from("client_notes")
        .select("id, body, created_at, author:profiles!client_notes_author_id_fkey(full_name)")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_requirements")
        .select("id, title, status, openings, priority, target_closure_date, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("placements")
        .select("placement_revenue, joining_date")
        .eq("client_id", id),
    ]);

  const stat = statuses.find((s) => s.value === client.status);
  const totalRevenue = placements?.reduce((s, p: any) => s + (p.placement_revenue ?? 0), 0) ?? 0;
  const canViewRevenue = hasPermission(profile, permissions, "kpi", "view_company") || profile.role?.name === "admin";

  return (
    <>
      <PageHeader
        title={client.name}
        description={`${client.industry ?? ""}${client.location ? ` · ${client.location}` : ""}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/clients">← Back</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <CompanyLogo name={client.name} logoUrl={client.logo_url} className="h-14 w-14" />
              <div>
                <CardTitle className="text-base">{client.name}</CardTitle>
                <div className="mt-1">
                  <StatusBadge label={stat?.label ?? client.status} color={stat?.color} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Website" value={client.website} link />
            <Row label="Industry" value={client.industry} />
            <Row label="Location" value={client.location} />
            <Row label="Company size" value={client.company_size} />
            <Row label="Contract" value={client.contract_type} />
            <Row label="Replacement" value={client.replacement_period_days ? `${client.replacement_period_days}d` : null} />
            <Row label="Payment" value={client.payment_terms_days ? `${client.payment_terms_days}d` : null} />
            <Row label="Added" value={formatDate(client.created_at)} />
            {canViewRevenue && (
              <Row label="Lifetime revenue" value={formatCurrency(totalRevenue)} />
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="jobs">
          <TabsList>
            <TabsTrigger value="jobs">Jobs ({jobs?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <LinkedJobsList clientId={id} rows={(jobs ?? []) as any} />
          </TabsContent>

          <TabsContent value="contacts">
            <ClientContacts clientId={id} contacts={(contacts ?? []) as any} />
          </TabsContent>

          <TabsContent value="notes">
            <ClientNotes clientId={id} notes={(notes ?? []) as any} />
          </TabsContent>

          <TabsContent value="edit">
            <ClientForm
              mode="edit"
              client={client as any}
              statuses={statuses}
              owners={owners ?? []}
              canEditCommercial={hasPermission(profile, permissions, "clients", "edit_commercial") || profile.role?.name === "admin"}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Row({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      {link ? (
        <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {value}
        </a>
      ) : (
        <span className="text-right">{value}</span>
      )}
    </div>
  );
}
