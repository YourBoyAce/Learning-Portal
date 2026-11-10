"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PremiumCalendarRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/live-sessions");
  }, [router]);

  return null;
}
