import { requireAuth } from "@/lib/auth";
import { withProfile, type Tx } from "@/lib/db";
import { sql } from "kysely";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskList } from "@/components/tasks/task-list";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";

export const metadata = { title: "Tasks · HR OS" };

export default async function TasksPage() {
  const { profile } = await requireAuth();
  const nowIso = new Date().toISOString();

  /** Open tasks with their assignee, oldest due date first, nulls last. */
  const openTasks = (trx: Tx) =>
    trx
      .selectFrom("tasks")
      .selectAll("tasks")
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom("profiles")
            .select("profiles.full_name")
            .whereRef("profiles.id", "=", "tasks.assigned_to_id"),
        ).as("assignee"),
      ])
      .where("status", "not in", ["completed", "cancelled"])
      .orderBy(sql`due_at asc nulls last`);

  const { mine, team, overdue, profiles } = await withProfile(profile.id, async (trx) => ({
    mine: await openTasks(trx).where("assigned_to_id", "=", profile.id).execute(),
    team: await openTasks(trx).limit(100).execute(),
    overdue: await openTasks(trx).where("due_at", "<", nowIso).execute(),
    profiles: await trx
      .selectFrom("profiles")
      .select(["id", "full_name"])
      .where("status", "=", "active")
      .execute(),
  }));

  return (
    <>
      <PageHeader title="Tasks & Follow-ups" description="Stay on top of follow-ups, reminders, and team tasks." />
      <CreateTaskInline profiles={profiles} />
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My tasks ({mine?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="team">Team ({team?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdue?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="mine"><TaskList rows={mine} /></TabsContent>
        <TabsContent value="team"><TaskList rows={team} /></TabsContent>
        <TabsContent value="overdue"><TaskList rows={overdue} /></TabsContent>
      </Tabs>
    </>
  );
}
