/** Why somebody may look: the reasons the privacy notice names, and no others. */
export const REASONS = [
  { id: "support", label: "The user asked for help" },
  { id: "fault", label: "Fixing a fault" },
  { id: "dispute", label: "A payment dispute" },
  { id: "security", label: "Fraud or security" },
] as const;

export const reasonLabel = (id: unknown): string => REASONS.find((r) => r.id === id)?.label ?? String(id ?? "—");

/** How long a logged reveal keeps the details on screen for the person who asked. */
export const SHOWN_FOR_MS = 15 * 60_000;
