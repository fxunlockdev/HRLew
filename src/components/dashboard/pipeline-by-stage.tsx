"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DataPoint {
  stage: string;
  count: number;
}

export function PipelineByStage({ data }: { data: DataPoint[] }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pipeline by stage</CardTitle>
        <CardDescription>Active candidate-job links</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {sorted.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No active pipeline
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" fontSize={11} stroke="#64748b" />
                <YAxis type="category" dataKey="stage" fontSize={11} width={120} stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
