import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CandidateCsvImport } from "@/components/candidates/csv-import";

export const metadata = { title: "Import candidates · HR OS" };

export default async function CandidateImportPage() {
  await requirePermission("candidates", "create");
  return (
    <>
      <PageHeader
        title="Import candidates"
        description="Bulk upload candidates from a CSV file. Duplicate emails are skipped."
      />
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-3">
            Required columns: <code className="rounded bg-slate-100 px-1.5 py-0.5">full_name</code>.
            Optional: <code className="rounded bg-slate-100 px-1.5 py-0.5">email, phone, current_company, current_designation, current_location, total_experience_years, current_ctc, expected_ctc, notice_period_days, skills, source</code>.
            Skills should be a semicolon-separated list (e.g. <code className="rounded bg-slate-100 px-1.5 py-0.5">React;Node.js</code>).
          </p>
          <CandidateCsvImport />
        </CardContent>
      </Card>
    </>
  );
}
