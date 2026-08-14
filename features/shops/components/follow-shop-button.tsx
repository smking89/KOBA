"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function FollowShopButton({
  slug,
  initialFollowing,
  signedIn,
  isOwner,
}: {
  slug: string;
  initialFollowing: boolean;
  signedIn: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (isOwner) {
    return null;
  }

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/shops/${slug}`);
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/shops/${slug}/follow`, { method: "POST" });
    const payload = (await response.json()) as { following?: boolean };
    setBusy(false);

    if (response.ok && typeof payload.following === "boolean") {
      setFollowing(payload.following);
      router.refresh();
    }
  }

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      onClick={() => void toggle()}
      disabled={busy}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
