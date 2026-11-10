"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyAdminWebinarsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/live-sessions");
  }, [router]);

  return null;
}
