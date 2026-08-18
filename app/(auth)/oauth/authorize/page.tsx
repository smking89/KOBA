import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthCard } from "@/components/koba/auth-card";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { findGrantByUserCode } from "@/features/oauth-device/services/device-flow.service";
import { DeviceConsentForm } from "@/features/oauth-device/components/device-consent-form";
import { DeviceCodeEntryForm } from "@/features/oauth-device/components/device-code-entry-form";

export const metadata = { title: "Connect a device" };
export const dynamic = "force-dynamic";

export default async function DeviceAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string }>;
}) {
  const { user_code: userCode } = await searchParams;

  const session = await auth();
  if (!session?.user.id) {
    const callbackUrl = userCode ? `/oauth/authorize?user_code=${encodeURIComponent(userCode)}` : "/oauth/authorize";
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (!userCode) {
    return (
      <AuthCard title="Connect a device" description="Link the KOBA PC Plugin to your account.">
        <DeviceCodeEntryForm />
      </AuthCard>
    );
  }

  let grant;
  try {
    grant = await findGrantByUserCode(userCode.toUpperCase());
  } catch {
    return (
      <AuthCard title="Connect a device" description="Link the KOBA PC Plugin to your account.">
        <AuthAlert variant="error">
          That code wasn&apos;t found or has expired. Go back to your device and try again.
        </AuthAlert>
        <div className="mt-4">
          <DeviceCodeEntryForm />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Connect a device" description="Confirm this is you before approving.">
      <DeviceConsentForm
        userCode={grant.grant.userCode}
        clientLabel={grant.clientLabel}
        scopes={grant.grant.scopes}
      />
    </AuthCard>
  );
}
