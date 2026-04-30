import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/app-sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const recent = session?.user?.id
    ? await prisma.analysis.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, fellowName: true, company: true, model: true, createdAt: true, result: true },
    })
    : [];

  const recentForSidebar = recent.map((r) => {
    const result = r.result as { score?: { value?: number } } | null;
    return {
      id: r.id,
      fellowName: r.fellowName,
      company: r.company,
      model: r.model,
      createdAt: r.createdAt.toISOString(),
      score: result?.score?.value ?? null,
    };
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar user={session?.user ?? null} recent={recentForSidebar} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}

