/*
 * The social calendar: what goes out on which day, the artwork, and the
 * caption for each platform.
 *
 * Kept as data in the repo rather than a table: the artwork is made by hand,
 * so a post only exists once its images are committed beside it, and a typo in
 * a caption is fixed with the same commit. The images live under
 * `public/content/<id>/`, numbered from 1 in the order they are posted.
 *
 * Captions follow the brand rules: plain English (no pidgin), no claims about
 * speed, and Balans makes and sends the invoice; the client pays the user,
 * straight into their bank.
 */

export type Platform = "instagram" | "x";

export type Post = {
  /** Folder under public/content, and the post's address in the calendar. */
  id: string;
  /** The day it goes out, in Lagos (YYYY-MM-DD). */
  date: string;
  title: string;
  kind: "Poster" | "Carousel";
  /** How many images are in the folder: 1.jpg, 2.jpg, ... */
  slides: number;
  instagram: { caption: string };
  /**
   * X takes at most four images, so a longer carousel names the four it
   * uses (1-based, in order). Leave it out to post every image.
   */
  x: { caption: string; slides?: number[] };
  /** Anything the person posting needs to know. */
  note?: string;
};

/** X counts a link as 23 characters whatever its length; we keep links bare, so plain length is close enough. */
export const X_LIMIT = 280;

const TAGS = "#Balans #Invoicing #Freelancers #SmallBusinessNigeria #WhatsAppBusiness";

export const POSTS: Post[] = [
  {
    id: "2026-10-31-how-balans-works",
    date: "2026-10-31",
    title: "How Balans works",
    kind: "Carousel",
    slides: 5,
    instagram: {
      caption: `How Balans works, in five slides.

1. Type the job in WhatsApp, like a text.
2. Balans drafts the invoice. Check it and tap Send it.
3. Your client pays you directly, by bank transfer. Balans never holds your money.
4. Late? Balans reminds them on the due date, then 3 and 7 days late.
5. Mark it paid, and they get a receipt.

No app to download. Your first 3 invoices are free.

Start at balans.ng

${TAGS}`,
    },
    x: {
      caption: `How Balans works:

1. Type the job in WhatsApp
2. Check the draft, tap Send it
3. Your client pays you directly
4. Late? Balans reminds them
5. Mark it paid, they get a receipt

First 3 invoices free. balans.ng`,
      slides: [1, 2, 4, 5],
    },
    note: "On X, post slides 1, 2, 4 and 5; the pack has them already picked.",
  },
  {
    id: "2026-11-01-happy-new-month",
    date: "2026-11-01",
    title: "Happy new month.",
    kind: "Poster",
    slides: 1,
    instagram: {
      caption: `Happy new month!

November is here. A new month of work, and every job deserves a proper invoice. Type the job on WhatsApp, check the draft Balans makes, and send it.

balans.ng

#HappyNewMonth #November ${TAGS}`,
    },
    x: {
      caption: `Happy new month.

November is here. Send every invoice on WhatsApp with Balans.

balans.ng`,
    },
  },
  {
    id: "2026-11-02-new-month-same-rule",
    date: "2026-11-02",
    title: "New month, same rule.",
    kind: "Poster",
    slides: 1,
    instagram: {
      caption: `New month, same rule: every job gets an invoice.

Not "I'll send the account number later". A proper invoice, made on WhatsApp with Balans, and your client pays you straight into your bank.

Your first 3 invoices are free. Start at balans.ng

${TAGS}`,
    },
    x: {
      caption: `New month, same rule. Every job gets an invoice.

Create it on WhatsApp with Balans. Your client pays you straight into your bank.

balans.ng`,
    },
  },
  {
    id: "2026-11-03-late-payer",
    date: "2026-11-03",
    title: "Late payer? Balans reminds them.",
    kind: "Poster",
    slides: 1,
    instagram: {
      caption: `Late payer? Balans reminds them.

When an invoice is due, Balans sends your client a polite reminder by email and WhatsApp, in your business name. Then again at 3 and 7 days late, so you don't have to chase.

Your client pays you straight into your bank. Balans never holds your money.

Start on WhatsApp at balans.ng

${TAGS}`,
    },
    x: {
      caption: `Late payer? Balans reminds them.

On the due date, then 3 and 7 days late. By email and WhatsApp, in your business name.

balans.ng`,
    },
  },
  {
    id: "2026-11-04-ask-for-payment",
    date: "2026-11-04",
    title: "How to ask for payment without sounding rude",
    kind: "Carousel",
    slides: 5,
    instagram: {
      caption: `How to ask for payment without sounding rude. Save this for the next time a client goes quiet.

Before the job starts: ask for the deposit. Name the amount and the start date.
On the due date: a gentle nudge, with the invoice link again.
7 days late: follow up with a question, not an accusation.
When they go quiet: set a date. Firm isn't rude.

Copy the messages from the slides and make them yours. Or let Balans send the reminders for you, in your business name.

balans.ng

#FreelanceTips #ClientManagement ${TAGS}`,
    },
    x: {
      caption: `How to ask for payment without sounding rude:

Before the job: ask for the deposit
Due date: a gentle nudge
7 days late: ask a question
Gone quiet: set a date

Four messages you can copy. Or let Balans send the reminders for you.

balans.ng`,
      slides: [2, 3, 4, 5],
    },
    note: "On X, post the four message slides (2 to 5); the cover is for Instagram.",
  },
];

/* -------------------------------------------------------------------------- */
/* Dates, always in Lagos                                                     */
/* -------------------------------------------------------------------------- */

/** Today in Lagos as YYYY-MM-DD (en-CA formats dates that way). */
export function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (day: string) => new Date(`${day}T00:00:00Z`);

export function isDay(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(at(s).getTime());
}

export function isMonth(s: string | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function postsOn(day: string): Post[] {
  return POSTS.filter((p) => p.date === day);
}

/** The next day from `day` on (inclusive) that has a post, if any. */
export function nextPostDay(day: string): string | null {
  return POSTS.map((p) => p.date).filter((d) => d >= day).sort()[0] ?? null;
}

export function shiftMonth(month: string, by: number): string {
  const d = at(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return iso(d).slice(0, 7);
}

/** Every day the month view shows: whole weeks, Monday first, padded from the months either side. */
export function monthDays(month: string): { day: string; inMonth: boolean }[] {
  const first = at(`${month}-01`);
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));
  const out: { day: string; inMonth: boolean }[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push({ day: iso(d), inMonth: iso(d).slice(0, 7) === month });
  }
  return out;
}

export function formatDay(day: string, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    timeZone: "UTC",
  }).format(at(day));
}

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(at(`${month}-01`));
}

export function slidePath(post: Post, n: number): string {
  return `/content/${post.id}/${n}.jpg`;
}
