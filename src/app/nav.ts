import type { IconName } from "@/components/icons";

/**
 * The back office's pages, in the order the sidebar lists them. Shared by the
 * desktop sidebar (server) and the phone nav (client), so it lives apart from
 * the shell, which reaches for server-only code.
 */
export const NAV = [
  { href: "/", label: "Overview", icon: "overview", group: "Business" },
  { href: "/users", label: "Users", icon: "users", group: "Business" },
  { href: "/payments", label: "Payments", icon: "card", group: "Business" },
  { href: "/waitlist", label: "Waitlist", icon: "clock", group: "Growth" },
  { href: "/broadcast", label: "Broadcast", icon: "send", group: "Growth" },
  { href: "/health", label: "Health", icon: "activity", group: "System" },
] as const satisfies readonly { href: string; label: string; icon: IconName; group: string }[];

export const GROUPS = ["Business", "Growth", "System"] as const;

export type NavHref = (typeof NAV)[number]["href"];

/** The four a phone shows as tabs; the rest sit behind "More". */
export const TABS: readonly NavHref[] = ["/", "/users", "/payments", "/waitlist"];
