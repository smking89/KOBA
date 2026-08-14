import { auth } from "@/lib/auth";
import { AidenGenerateWorkspace } from "@/features/aiden/components/aiden-generate-workspace";
import { listJobs } from "@/features/aiden/services/aiden.service";

export const metadata = { title: "Aiden generate" };

export default async function AidenGeneratePage() {
  const session = await auth();
  const initialJobs = session?.user.id ? await listJobs(session.user.id).catch(() => []) : [];
  return <AidenGenerateWorkspace initialJobs={initialJobs} />;
}
