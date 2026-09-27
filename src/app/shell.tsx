import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase";
import { access, type Staff } from "@/lib/supabase-server";
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
  { href: "/", label: "Overview" },
  { href: "/users", label: "Users" },
  { href: "/payments", label: "Payments" },
  { href: "/waitlist", label: "Waitlist" },
] as const;

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
  return (
    <div className="container-x py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap items-center gap-1 rounded-full bg-white p-1 ring-1 ring-ink/10 ring-inset">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.href === current ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                n.href === current ? "bg-ink text-cream" : "text-ink/60 hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink/50 sm:inline">{email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-ink/60 transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {sub && <p className="mt-1 text-sm text-ink/55">{sub}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Failed({ what, error }: { what: string; error: string }) {
  return (
    <p className="rounded-2xl bg-white px-5 py-4 text-sm text-clay ring-1 ring-clay/20 ring-inset">
      Could not read {what}: {error}. If this says a table or relation does not exist, the API has not yet
      applied its latest migrations to this database — they run when it next deploys.
    </p>
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
      <div className="w-full rounded-[20px] bg-white px-6 py-6 ring-1 ring-ink/10 ring-inset">
        <h1 className="font-display text-xl font-bold tracking-tight">You are signed in, but not staff</h1>
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
      <div className="rounded-[20px] bg-white px-6 py-6 ring-1 ring-ink/10 ring-inset">
        <h1 className="font-display text-xl font-bold tracking-tight">Admin is not configured</h1>
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
