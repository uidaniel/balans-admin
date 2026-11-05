import Link from "next/link";

/** What the totals leave out, so nobody wonders why a figure dropped. */
export function LeftOutLine({ counts }: { counts: { accounts: number; invoices: number } | null }) {
  if (!counts || (counts.accounts === 0 && counts.invoices === 0)) return null;
  const parts = [
    counts.accounts ? `${counts.accounts} test ${counts.accounts === 1 ? "account" : "accounts"}` : null,
    counts.invoices ? `${counts.invoices} ${counts.invoices === 1 ? "invoice" : "invoices"}` : null,
  ].filter(Boolean);
  return (
    <p className="mb-4 text-xs text-ink/50">
      Totals leave out {parts.join(" and ")}.{" "}
      <Link href="/test-data" className="underline hover:text-ink">
        Review test data
      </Link>
    </p>
  );
}
