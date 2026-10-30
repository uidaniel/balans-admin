import { isDay, isMonth, lagosToday, nextPostDay, postsOn } from "@/lib/content";
import { gate, Shell } from "../shell";
import { Calendar } from "./calendar";

export const dynamic = "force-dynamic";

/**
 * The social calendar: a month of posts, and the chosen day's post with
 * everything needed to put it out. It opens on today, or on the next day
 * that has something to post.
 */
export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; month?: string }>;
}) {
  const g = await gate();
  if (!g.staff) return g.stop;

  const params = await searchParams;
  const today = lagosToday();
  const day = isDay(params.day) ? params.day : postsOn(today).length ? today : (nextPostDay(today) ?? today);
  const month = isMonth(params.month) ? params.month : day.slice(0, 7);

  return (
    <Shell
      email={g.staff.email}
      current="/content"
      title="Content"
      sub="What goes out each day on Instagram and X. Download the pack for the platform, upload the images, paste the caption."
    >
      <Calendar day={day} month={month} today={today} />
    </Shell>
  );
}
