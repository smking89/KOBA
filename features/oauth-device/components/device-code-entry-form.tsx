"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DeviceCodeEntryForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!code.trim()) return;
        router.push(`/oauth/authorize?user_code=${encodeURIComponent(code.trim())}`);
      }}
    >
      <p className="text-sm text-muted">Enter the code shown on your device.</p>
      <Input
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="WDJB-MJHT"
        autoComplete="off"
        className="text-center font-mono text-lg tracking-widest"
      />
      <Button type="submit" className="w-full">
        Continue
      </Button>
    </form>
  );
}
