import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { CandidatesFilters } from "@/components/candidates/candidates-filters";
import { getSettingsList } from "@/lib/settings";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Candidates · HRLew" };

interface SearchParams {
  q?: string;
  status?: string;
  recruiter?: string;
  page?: string;
}

const PAGE_SIZE = 20;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, permissions } = await requireAuth();
  const sp = await searchParams;
  const supabase = await getSupabaseServerClient();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("candidates")
    .select(
      "id, display_id, full_name, email, phone, current_company, current_designation, current_location, total_experience_years, expected_ctc, status, skills, assigned_recruiter_id, created_at, recruiter:profiles!candidates_assigned_recruiter_id_fkey(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (sp.q) {
    query = query.or(
      `full_name.ilike.%${sp.q}%,email.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,current_company.ilike.%${sp.q}%`,
    );
  }
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.recruiter) query = query.eq("assigned_recruiter_id", sp.recruiter);

  const [{ data: candidates, count }, statuses, { data: recruiters }] = await Promise.all([
    query,
    getSettingsList("candidate_status"),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  const canCreate = hasPermission(profile, permissions, "candidates", "create");

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Central candidate database. Add, search, filter and submit to jobs."
        actions={
          canCreate && (
            <>
              <Button asChild variant="outline">
                <Link href="/candidates/import">
                  <Upload className="h-4 w-4" /> Import CSV
                </Link>
              </Button>
              <Button asChild>
                <Link href="/candidates/new">
                  <Plus className="h-4 w-4" /> New candidate
                </Link>
              </Button>
            </>
          )
        }
      />

      <CandidatesFilters statuses={statuses} recruiters={recruiters ?? []} />

      <CandidatesTable
        rows={(candidates ?? []) as any}
        statuses={statuses}
        canViewCtc={hasPermission(profile, permissions, "candidates", "view_sensitive")}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </>
  );
}
