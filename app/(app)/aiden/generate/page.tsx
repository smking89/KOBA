import { redirect } from "next/navigation";

export const metadata = { title: "Aiden generate" };

export default function AidenGenerateRedirectPage() {
  redirect("/aiden/create");
}
