"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface DataPoint {
  month: string;
  count: number;
  revenue: number;
}

interface Props {
  data: DataPoint[];
  showRevenue: boolean;
}

export function PlacementChart({ data, showRevenue }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Placements & revenue · last 6 months</CardTitle>
        <CardDescription>Joined placements with associated revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {data.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No placements yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={12} stroke="#64748b" />
                <YAxis yAxisId="left" fontSize={12} stroke="#64748b" />
                {showRevenue && <YAxis yAxisId="right" orientation="right" fontSize={12} stroke="#64748b" />}
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "revenue" ? formatCurrency(value) : value
                  }
                />
                <Bar yAxisId="left" dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Placements" />
                {showRevenue && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot
                    name="Revenue"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
