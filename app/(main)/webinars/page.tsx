"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyWebinarsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/live-sessions");
  }, [router]);

  return null;
}
