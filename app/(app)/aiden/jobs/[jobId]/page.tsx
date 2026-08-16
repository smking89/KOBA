import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { AidenJobStatus } from "@/features/aiden/components/aiden-job-status";
import { AidenError } from "@/features/aiden/lib/errors";
import { getJob } from "@/features/aiden/services/aiden.service";

export const metadata = { title: "Aiden job" };

export default async function AidenJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const session = await auth();
  if (!session?.user.id) {
    notFound();
  }
  const { jobId } = await params;
  try {
    const job = await getJob(session.user.id, jobId);
    return <AidenJobStatus initial={job} />;
  } catch (error) {
    if (error instanceof AidenError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}
