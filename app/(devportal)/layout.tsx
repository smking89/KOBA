import { DevPortalShell } from "@/components/koba/dev-portal-shell";

export default function DevPortalLayout({ children }: { children: React.ReactNode }) {
  return <DevPortalShell>{children}</DevPortalShell>;
}
