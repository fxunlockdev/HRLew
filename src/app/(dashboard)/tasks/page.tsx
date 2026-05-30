import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskList } from "@/components/tasks/task-list";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";

export const metadata = { title: "Tasks · HR OS" };

export default async function TasksPage() {
  const { profile } = await requireAuth();
  const supabase = await getSupabaseServerClient();

  const nowIso = new Date().toISOString();
  const [
    { data: mine },
    { data: team },
    { data: overdue },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assigned_to_id_fkey(full_name)")
      .eq("assigned_to_id", profile.id)
      .not("status", "in", "(completed,cancelled)")
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assigned_to_id_fkey(full_name)")
      .not("status", "in", "(completed,cancelled)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assigned_to_id_fkey(full_name)")
      .lt("due_at", nowIso)
      .not("status", "in", "(completed,cancelled)")
      .order("due_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name").eq("status", "active"),
  ]);

  return (
    <>
      <PageHeader title="Tasks & Follow-ups" description="Stay on top of follow-ups, reminders, and team tasks." />
      <CreateTaskInline profiles={profiles ?? []} />
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My tasks ({mine?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="team">Team ({team?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdue?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="mine"><TaskList rows={(mine ?? []) as any} /></TabsContent>
        <TabsContent value="team"><TaskList rows={(team ?? []) as any} /></TabsContent>
        <TabsContent value="overdue"><TaskList rows={(overdue ?? []) as any} /></TabsContent>
      </Tabs>
    </>
  );
}
