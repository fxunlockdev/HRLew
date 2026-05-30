import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

interface Row {
  name: string;
  placements: number;
  revenue: number;
}

export function TopRecruiters({ data, showRevenue }: { data: Row[]; showRevenue: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top recruiters · last 30 days</CardTitle>
        <CardDescription>By number of placements</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState title="No placements in the last 30 days" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recruiter</TableHead>
                <TableHead className="text-right">Placements</TableHead>
                {showRevenue && <TableHead className="text-right">Revenue</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{r.placements}</TableCell>
                  {showRevenue && (
                    <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
