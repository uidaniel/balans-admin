// Display helpers only. Amounts are always integer kobo; nothing here computes fees.

const nf = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 35000000 -> "₦350,000"; shows kobo only when there are any. */
export function naira(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(kobo);
  const body = abs % 100 === 0 ? nf.format(abs / 100) : nf2.format(abs / 100);
  return `${sign}₦${body}`;
}

const lagos = "Africa/Lagos";

/** "Friday, 25 September 2026" */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: lagos,
  }).format(new Date(iso));
}

/** "25 Sep 2026" */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: lagos,
  }).format(new Date(iso));
}
