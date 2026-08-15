import { AidenGenerateWorkspace } from "@/features/aiden/components/aiden-generate-workspace";
import { listJobs } from "@/features/aiden/services/aiden.service";
import { requireAidenPage } from "@/features/aiden/lib/require-business";

export const metadata = { title: "Aiden generate" };

export default async function AidenGeneratePage() {
  const { userId } = await requireAidenPage("/aiden/generate");
  const initialJobs = await listJobs(userId).catch(() => []);
  return <AidenGenerateWorkspace initialJobs={initialJobs} />;
}
