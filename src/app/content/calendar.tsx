import Image from "next/image";
import Link from "next/link";
import { Card, Empty, Pill } from "@/components/ui";
import { Icon } from "@/components/icons";
import {
  POSTS,
  formatDay,
  formatMonth,
  monthDays,
  nextPostDay,
  postsOn,
  shiftMonth,
  slidePath,
} from "@/lib/content";
import { PostPanel } from "./post-panel";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The month of posts beside the chosen day's post, and what is coming up. */
export function Calendar({ day, month, today }: { day: string; month: string; today: string }) {
  const posts = postsOn(day);
  const upcoming = POSTS.filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const href = (d: string, m = d.slice(0, 7)) => `/content?day=${d}&month=${m}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="space-y-4">
        <Card
          title={formatMonth(month)}
          sub={`${POSTS.filter((p) => p.date.startsWith(month)).length} posts this month`}
          action={
            <div className="flex gap-1">
              <Link
                href={`/content?day=${day}&month=${shiftMonth(month, -1)}`}
                aria-label="Previous month"
                className="grid size-9 place-items-center rounded-full border border-line text-ink/60 hover:bg-canvas hover:text-ink"
              >
                <Icon name="arrowRight" className="size-4 rotate-180" />
              </Link>
              <Link
                href={`/content?day=${day}&month=${shiftMonth(month, 1)}`}
                aria-label="Next month"
                className="grid size-9 place-items-center rounded-full border border-line text-ink/60 hover:bg-canvas hover:text-ink"
              >
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-medium text-ink/40 sm:gap-1.5">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1">
                {w}
              </span>
            ))}
            {monthDays(month).map(({ day: d, inMonth }) => {
              const first = postsOn(d)[0];
              const on = d === day;
              const isToday = d === today;
              return (
                <Link
                  key={d}
                  href={href(d, month)}
                  aria-current={on ? "date" : undefined}
                  aria-label={`${formatDay(d)}${first ? `: ${first.title}` : ""}`}
                  className={`group relative flex aspect-[4/5] flex-col overflow-hidden rounded-xl border text-left transition-colors ${
                    on ? "border-ink ring-2 ring-ink" : "border-line hover:border-sand-2"
                  } ${inMonth ? "bg-white" : "bg-canvas/60"}`}
                >
                  {first && (
                    <Image
                      src={slidePath(first, 1)}
                      alt=""
                      width={216}
                      height={270}
                      unoptimized
                      className="absolute inset-0 hidden size-full object-cover sm:block"
                    />
                  )}
                  <span
                    className={`relative m-1 grid size-6 place-items-center rounded-full text-[0.72rem] tabular-nums ${
                      isToday
                        ? "bg-marigold font-semibold text-ink"
                        : first
                          ? "bg-white/90 font-medium text-ink sm:shadow-card"
                          : inMonth
                            ? "text-ink/60"
                            : "text-ink/25"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {first && <span className="relative mx-auto mt-auto mb-1.5 size-1.5 rounded-full bg-marigold sm:hidden" />}
                </Link>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-ink/45">
            <span className="size-2.5 rounded-full bg-marigold" /> Today, in Lagos
          </p>
        </Card>

        <Card title="Coming up" sub="Everything scheduled from today" flush>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((p) => (
                <li key={p.id} className="overflow-hidden last:rounded-b-[22px]">
                  <Link
                    href={href(p.date)}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper sm:px-6 ${p.date === day ? "bg-paper" : ""}`}
                  >
                    <Image
                      src={slidePath(p, 1)}
                      alt=""
                      width={108}
                      height={135}
                      unoptimized
                      className="aspect-[4/5] w-10 shrink-0 rounded-lg border border-line object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-ink/50">{formatDay(p.date)}</p>
                    </div>
                    {p.date === today ? <Pill tone="marigold">Today</Pill> : <Pill>{p.kind}</Pill>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="clock">Nothing scheduled from today on. Add posts in src/lib/content.ts.</Empty>
          )}
        </Card>
      </div>

      <Card
        title={formatDay(day)}
        sub={day === today ? "Today" : day < today ? "Already gone out" : undefined}
        className="order-first lg:sticky lg:top-6 lg:order-none"
      >
        {posts.length ? (
          <div className="space-y-8">
            {posts.map((p) => (
              <PostPanel key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <Empty icon="clock">
            Nothing to post on {formatDay(day, "short")}.
            {nextPostDay(day) && (
              <>
                {" "}
                <Link href={href(nextPostDay(day)!)} className="font-medium text-ink underline underline-offset-2">
                  Next post: {formatDay(nextPostDay(day)!, "short")}
                </Link>
              </>
            )}
          </Empty>
        )}
      </Card>
    </div>
  );
}
