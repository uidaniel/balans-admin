import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase";
import { access, type Staff } from "@/lib/supabase-server";
import { Avatar, Logo, btn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { signOut } from "./actions";
import { MobileNav } from "./mobile-nav";
import { GROUPS, NAV, type NavHref } from "./nav";

/*
 * Every page's frame, and every page's gate.
 *
 * The gate is here rather than repeated per page so that a new page cannot be
 * added without it: `gate()` is how a page gets the staff member it needs to
 * render at all. Signing in is not enough — the allowlist decides.
 */

export type Gate = { staff: Staff; stop: null } | { staff: null; stop: React.ReactNode };

export async function gate(): Promise<Gate> {
  if (!supabaseConfigured) return { staff: null, stop: <NotConfigured /> };
  const who = await access();
  if (who.kind === "anonymous") redirect("/login");
  if (who.kind === "not_staff") return { staff: null, stop: <NotStaff authUserId={who.authUserId} email={who.email} /> };
  return { staff: who.staff, stop: null };
}

/**
 * Desktop: a night-green sidebar with a soft marigold glow, and the page on
 * the warm canvas beside it. Phone and tablet: the top bar, tab bar and sheet
 * in `MobileNav`. Data always sits on light cards, whatever the frame.
 */
export function Shell({
  email,
  current,
  title,
  sub,
  actions,
  children,
}: {
  email: string;
  current: NavHref;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const name = email.split("@")[0] ?? email;
  return (
    <div className="min-h-dvh">
      {/* Sidebar, from lg up. */}
      <aside className="on-night fixed inset-y-0 left-0 z-30 hidden w-66 flex-col overflow-hidden bg-night px-4 py-6 text-cream lg:flex">
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-marigold/[0.16] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-moss/20 blur-3xl" />
        <div aria-hidden className="noise pointer-events-none absolute inset-0" />

        <Link href="/" className="relative flex items-center gap-2.5 self-start rounded-full px-2 py-1">
          <Logo tone="dark" className="h-7 w-auto" />
          <span className="rounded-full bg-cream/10 px-2 py-0.5 text-[0.68rem] font-medium text-cream/70">Admin</span>
        </Link>

        <nav aria-label="Main" className="relative mt-10 flex-1 space-y-7 overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="px-3 text-xs font-medium text-cream/40">{group}</p>
              <ul className="mt-2 space-y-0.5">
                {NAV.filter((n) => n.group === group).map((n) => {
                  const on = n.href === current;
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        aria-current={on ? "page" : undefined}
                        className={`flex h-10 items-center gap-3 rounded-full px-3.5 text-sm transition-colors ${
                          on
                            ? "bg-cream/[0.1] font-medium text-cream shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                            : "text-cream/60 hover:bg-cream/[0.05] hover:text-cream"
                        }`}
                      >
                        <Icon name={n.icon} className={`size-[1.1rem] ${on ? "text-marigold" : "text-cream/45"}`} />
                        <span className="flex-1">{n.label}</span>
                        {on && <span aria-hidden className="size-1.5 rounded-full bg-marigold" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative rounded-[20px] bg-cream/[0.06] p-2.5 shadow-[inset_0_0_0_1px_rgb(246_241_231/0.08)]">
          <div className="flex items-center gap-3">
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-cream/50">{email}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="grid size-10 place-items-center rounded-full text-cream/55 transition-colors hover:bg-cream/10 hover:text-cream"
              >
                <Icon name="logout" className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <MobileNav current={current} name={name} email={email} />

      <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-66">
        <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-8 sm:px-6 lg:px-10 lg:pt-10 lg:pb-14">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs text-ink/50">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-moss opacity-50 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-moss" />
                </span>
                Live · {lagosNow()} Lagos
              </p>
              <h1 className="mt-2 font-display text-[2rem] leading-[1.05] font-light tracking-[-0.035em] sm:text-[2.5rem]">
                {title}
              </h1>
              {sub && <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink/55">{sub}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          <div className="mt-6 sm:mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

function lagosNow(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date());
}

export function Failed({ what, error }: { what: string; error: string }) {
  return (
    <div className="flex gap-3 rounded-[20px] border border-clay/20 bg-[#fbefea] px-4 py-4 text-sm sm:px-5">
      <span className="mt-0.5 text-clay">
        <Icon name="alert" className="size-4" />
      </span>
      <p className="min-w-0 leading-relaxed break-words text-ink/75">
        <strong className="font-medium text-clay">Could not read {what}:</strong> {error}. If this says a table or
        relation does not exist, the API has not yet applied its latest migrations to this database — they run when it
        next deploys.
      </p>
    </div>
  );
}

/** The page the gate shows instead of the shell: the coin, a card, nothing else. */
function Standalone({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <Logo tone="light" className="h-8 w-auto" />
        <div className="mt-6 rounded-[22px] border border-line bg-white px-5 py-6 shadow-card sm:px-7">{children}</div>
      </div>
    </main>
  );
}

/**
 * The first sign-in always lands here: Supabase Auth has the person, the
 * allowlist does not yet. Rather than a dead end, hand over the exact row to
 * insert — there is no other way to bootstrap the first admin.
 */
function NotStaff({ authUserId, email }: { authUserId: string; email: string }) {
  const sql = `insert into admin_allowlist (auth_user_id, email, role)
values ('${authUserId}', '${email}', 'admin');`;
  return (
    <Standalone>
      <h1 className="font-display text-[1.6rem] leading-tight font-light tracking-[-0.025em]">You are signed in, but not staff</h1>
      <p className="mt-3 leading-relaxed text-ink/70">
        Signing in is not the same as being allowed in. To add <strong className="font-medium">{email}</strong>, run this in
        the Supabase SQL editor, then reload:
      </p>
      <pre className="scroll-x mt-4 rounded-2xl bg-night px-4 py-3.5 font-mono text-[0.8rem] leading-relaxed text-cream">
        {sql}
      </pre>
      <form action={signOut} className="mt-5">
        <button type="submit" className={btn.secondary}>
          <Icon name="logout" className="size-4" />
          Sign out
        </button>
      </form>
    </Standalone>
  );
}

function NotConfigured() {
  return (
    <Standalone>
      <h1 className="font-display text-[1.6rem] leading-tight font-light tracking-[-0.025em]">Admin is not configured</h1>
      <p className="mt-3 leading-relaxed text-ink/70">
        Set <code className="rounded-md bg-canvas px-1.5 py-0.5 font-mono text-[0.85em]">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
        <code className="rounded-md bg-canvas px-1.5 py-0.5 font-mono text-[0.85em]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
        <code className="rounded-md bg-canvas px-1.5 py-0.5 font-mono text-[0.85em]">SUPABASE_SERVICE_ROLE_KEY</code>, then
        redeploy.
      </p>
    </Standalone>
  );
}
