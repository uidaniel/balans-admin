"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Reloads the page's data every 30 seconds while it is open, and on a tap. */
export function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="h-9 rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink/70 hover:bg-canvas hover:text-ink"
    >
      Refresh
    </button>
  );
}
