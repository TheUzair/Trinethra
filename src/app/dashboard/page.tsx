import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Analyzer } from "./analyzer";

export const metadata = { title: "Analyze · Trinethra" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;

  // Load a saved analysis when sidebar recent item is clicked
  let initialAnalysis: unknown = null;
  let initialTranscript = "";
  let initialFellowName = "";
  let initialCompany = "";
  let initialSupervisor = "";
  let initialModel = "";

  if (params.a) {
    const row = await prisma.analysis.findFirst({
      where: { id: params.a, userId: session.user.id },
    });
    if (row) {
      initialAnalysis = row.result;
      initialTranscript = row.transcript;
      initialFellowName = row.fellowName ?? "";
      initialCompany = row.company ?? "";
      initialSupervisor = row.supervisor ?? "";
      initialModel = row.model ?? "";
    }
  }

  return (
    <Analyzer
      initialAnalysis={initialAnalysis}
      initialTranscript={initialTranscript}
      initialFellowName={initialFellowName}
      initialCompany={initialCompany}
      initialSupervisor={initialSupervisor}
      initialModel={initialModel}
    />
  );
}

