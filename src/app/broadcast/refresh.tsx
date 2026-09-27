"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page every few seconds while something is still sending. */
export function RefreshWhile({ active, every = 4000 }: { active: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [active, every, router]);
  return null;
}
