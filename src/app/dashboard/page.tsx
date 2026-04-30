import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Analyzer } from "./analyzer";

export const metadata = { title: "Analyze · Trinethra" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null; // middleware will redirect

  const recent = await prisma.analysis.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      fellowName: true,
      company: true,
      model: true,
      createdAt: true,
      result: true,
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {session.user.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste a transcript on the left, run analysis, review the draft on the right.
        </p>
      </div>
      <Analyzer recent={recent.map((r) => ({
        id: r.id,
        fellowName: r.fellowName,
        company: r.company,
        model: r.model,
        createdAt: r.createdAt.toISOString(),
        // result is JsonValue; coerce to unknown for the client
        result: r.result as unknown,
      }))} />
    </main>
  );
}
