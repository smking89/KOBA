import Link from "next/link";
import { ServerConnectWizard } from "@/features/servers/components/server-connect-wizard";

export const metadata = { title: "Connect server" };

export default function ServerConnectPage() {
  return (
    <div className="space-y-6">
      <CardNote />
      <ServerConnectWizard />
    </div>
  );
}

function CardNote() {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
      <p>
        <strong className="text-foreground">Phase 14E:</strong> RCON credential storage and live
        connection tests land next. Register and verify servers from{" "}
        <Link href="/servers/manage" className="text-neon-mint hover:underline">
          /servers/manage
        </Link>
        .
      </p>
    </div>
  );
}
