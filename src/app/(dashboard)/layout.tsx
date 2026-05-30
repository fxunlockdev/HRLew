import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, permissions } = await requireAuth();

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <Sidebar profile={profile} permissions={permissions} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar profile={profile} />
        <main className="flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
