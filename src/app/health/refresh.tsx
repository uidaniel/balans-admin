"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { btn } from "@/components/ui";

/** Reloads the page's data every 30 seconds while it is open, and on a tap. */
export function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <button type="button" onClick={() => router.refresh()} className={btn.secondary}>
      Refresh
    </button>
  );
}
