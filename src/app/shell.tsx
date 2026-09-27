import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase";
import { access, type Staff } from "@/lib/supabase-server";
import { Avatar, Logo } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { signOut } from "./actions";

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

const NAV = [
  { href: "/", label: "Overview", icon: "overview", group: "Business" },
  { href: "/users", label: "Users", icon: "users", group: "Business" },
  { href: "/payments", label: "Payments", icon: "card", group: "Business" },
  { href: "/waitlist", label: "Waitlist", icon: "clock", group: "Growth" },
] as const satisfies readonly { href: string; label: string; icon: IconName; group: string }[];

const GROUPS = ["Business", "Growth"] as const;

export function Shell({
  email,
  current,
  title,
  sub,
  actions,
  children,
}: {
  email: string;
  current: (typeof NAV)[number]["href"];
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const name = email.split("@")[0] ?? email;
  return (
    <div className="min-h-dvh">
      {/* Sidebar, from lg up. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white px-4 py-5 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <Logo tone="light" className="h-7 w-auto" />
          <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[0.68rem] font-semibold tracking-wide text-ink/55 uppercase">
            Admin
          </span>
        </Link>

        <nav className="mt-8 flex-1 space-y-6 overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="px-3 text-[0.7rem] font-medium tracking-wider text-ink/35 uppercase">{group}</p>
              <ul className="mt-2 space-y-0.5">
                {NAV.filter((n) => n.group === group).map((n) => {
                  const on = n.href === current;
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        aria-current={on ? "page" : undefined}
                        className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                          on ? "bg-ink text-cream" : "text-ink/60 hover:bg-canvas hover:text-ink"
                        }`}
                      >
                        <Icon name={n.icon} className={`size-[1.1rem] ${on ? "text-marigold" : ""}`} />
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="rounded-2xl border border-line bg-canvas/60 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-ink/50">{email}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="grid size-8 place-items-center rounded-lg text-ink/50 transition-colors hover:bg-white hover:text-clay"
              >
                <Icon name="logout" className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Top bar, below lg. */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo tone="light" className="h-6 w-auto" />
            <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-ink/55 uppercase">
              Admin
            </span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid size-9 place-items-center rounded-lg text-ink/55 hover:bg-canvas hover:text-clay"
            >
              <Icon name="logout" className="size-4" />
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.href === current ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
                n.href === current ? "bg-ink text-cream" : "text-ink/60 hover:bg-canvas"
              }`}
            >
              <Icon name={n.icon} className={`size-4 ${n.href === current ? "text-marigold" : ""}`} />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-medium text-ink/45">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-moss opacity-50 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-moss" />
                </span>
                Live · {lagosNow()} Lagos
              </p>
              <h1 className="mt-1.5 font-display text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
              {sub && <p className="mt-1 max-w-3xl text-sm text-ink/55">{sub}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          <div className="mt-6">{children}</div>
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
    <div className="flex gap-3 rounded-2xl border border-clay/20 bg-clay/[0.04] px-5 py-4 text-sm">
      <span className="mt-0.5 text-clay">
        <Icon name="alert" className="size-4" />
      </span>
      <p className="leading-relaxed text-ink/75">
        <strong className="font-semibold text-clay">Could not read {what}:</strong> {error}. If this says a table or
        relation does not exist, the API has not yet applied its latest migrations to this database — they run when it
        next deploys.
      </p>
    </div>
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
    <main className="container-x grid min-h-dvh max-w-2xl place-items-center py-10">
      <div className="w-full rounded-2xl border border-line bg-white px-6 py-6">
        <h1 className="font-display text-xl font-semibold tracking-tight">You are signed in, but not staff</h1>
        <p className="mt-3 leading-relaxed text-ink/70">
          Signing in is not the same as being allowed in. To add <strong>{email}</strong>, run this in the
          Supabase SQL editor, then reload:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink px-4 py-3 font-mono text-[0.8rem] leading-relaxed text-cream">
          {sql}
        </pre>
        <form action={signOut} className="mt-5">
          <button type="submit" className="text-sm font-semibold text-ink/60 hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <main className="container-x grid min-h-dvh max-w-xl place-items-center py-10">
      <div className="rounded-2xl border border-line bg-white px-6 py-6">
        <h1 className="font-display text-xl font-semibold tracking-tight">Admin is not configured</h1>
        <p className="mt-3 leading-relaxed text-ink/70">
          Set <code className="rounded bg-ink/8 px-1.5 py-0.5 text-[0.9em]">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="rounded bg-ink/8 px-1.5 py-0.5 text-[0.9em]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
          <code className="rounded bg-ink/8 px-1.5 py-0.5 text-[0.9em]">SUPABASE_SERVICE_ROLE_KEY</code>, then
          redeploy.
        </p>
      </div>
    </main>
  );
}
