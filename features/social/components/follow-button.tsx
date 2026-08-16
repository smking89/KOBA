"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function FollowButton({
  handle,
  signedIn,
  isSelf,
  initialFollowing,
}: {
  handle: string;
  signedIn: boolean;
  isSelf: boolean;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (isSelf) {
    return null;
  }

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?callbackUrl=/u/${handle}`);
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/social/follow/${handle}`, { method: "POST" });
    const payload = (await response.json()) as { following?: boolean };
    setBusy(false);
    if (response.ok && typeof payload.following === "boolean") {
      setFollowing(payload.following);
      router.refresh();
    }
  }

  return (
    <Button
      size="sm"
      variant={following ? "secondary" : "primary"}
      onClick={() => void toggle()}
      disabled={busy}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
