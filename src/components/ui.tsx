import Image from "next/image";

type Tone = "light" | "dark";

/**
 * The wordmark.
 *
 * Copied from the marketing site rather than shared: this is a separate
 * application now, and a login screen that cannot render because a package was
 * not published is a login screen nobody can use. The file is small and it
 * changes about once a year.
 */
export function Logo({ tone = "light", className = "h-7 w-auto" }: { tone?: Tone; className?: string }) {
  return (
    <Image
      src={`/brand/balans-logo-${tone}.svg`}
      alt="Balans"
      width={467}
      height={160}
      className={className}
      unoptimized
      priority
    />
  );
}
