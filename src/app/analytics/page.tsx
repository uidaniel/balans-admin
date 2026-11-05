import { serviceClient } from "@/lib/supabase";
import { naira } from "@/lib/money";
import {
  loadAccounts,
  loadActivation,
  loadCohorts,
  loadDaily,
  loadInsights,
  loadInvoiceLoop,
  loadOverview,
  loadSetup,
  loadSources,
  loadWeekly,
  loadWhatsApp,
} from "@/lib/dashboard";
import { ColumnChart } from "@/components/charts";
import { Card, Empty, Segmented } from "@/components/ui";
import { MetricsPanel, type Metrics } from "../metrics";
import { compactNaira, dayMonth } from "../parts";
import { Failed, gate, Shell } from "../shell";
import { loadLeftOutCounts, loadSetupSteps } from "@/lib/test-data";
import { LeftOutLine } from "@/components/left-out";
import { GrowthSection, InvoicesPaid, MoneySection, RetentionSection, UsageSection, WhatsAppSection } from "./sections";

export const dynamic = "force-dynamic";

/*
 * Everything measured, by subject (3 November 2026). The Overview keeps the
 * headline figures; the detail lives here, one tab at a time, and each tab
 * reads only what it shows. The tab is in the address, so it can be shared.
 */

const TABS = [
  { id: "growth", label: "Growth" },
  { id: "retention", label: "Retention" },
  { id: "money", label: "Money" },
  { id: "usage", label: "Usage" },
  { id: "whatsapp", label: "WhatsApp" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const SUB: Record<Tab, string> = {
  growth: "Who is joining, from where, and how far they get.",
  retention: "How fast people get going, and whether they keep sending.",
  money: "What clients paid, what is still owed, and what Balans keeps.",
  usage: "What people send, how it looks, and what happens to it.",
  whatsapp: "What Meta charged, and what goes back and forth in the chat.",
};

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const g = await gate();
  if (!g.staff) return g.stop;

  const asked = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.id === asked) ? (asked as Tab) : "growth";

  return (
    <Shell email={g.staff.email} current="/analytics" title="Analytics" sub={SUB[tab]}>
      <Segmented current={tab} items={TABS.map((t) => ({ id: t.id, label: t.label, href: `/analytics?tab=${t.id}` }))} />
      <div className="-mt-6">{await body(tab)}</div>
      <div className="mt-6">
        <LeftOutLine counts={await loadLeftOutCounts()} />
      </div>
    </Shell>
  );
}

async function body(tab: Tab) {
  switch (tab) {
    case "growth": {
      const [overview, daily, insights, setup, sources, weekly, loop, top, steps] = await Promise.all([
        loadOverview(),
        loadDaily(),
        loadInsights(),
        loadSetup(),
        loadSources(),
        loadWeekly(),
        loadInvoiceLoop(),
        loadAccounts("", "invoiced"),
        loadSetupSteps(),
      ]);
      if (!overview.data || !daily.data) return <Failed what="growth" error={overview.error ?? daily.error ?? "unknown"} />;
      const onPro = top.data ? top.data.filter((a) => a.plan === "pro").length : null;
      return (
        <GrowthSection
          o={overview.data}
          days={daily.data}
          i={insights.data}
          s={setup}
          onPro={onPro}
          weekly={weekly}
          sources={sources}
          loop={loop}
          steps={steps}
        />
      );
    }

    case "retention": {
      const [activation, cohorts, health] = await Promise.all([loadActivation(), loadCohorts(), loadHealth()]);
      return <RetentionSection activation={activation} cohorts={cohorts} proLapsed={health ? Number(health.pro_lapsed_30d) : null} />;
    }

    case "money": {
      const [overview, daily, insights, whatsapp, health] = await Promise.all([
        loadOverview(),
        loadDaily(),
        loadInsights(),
        loadWhatsApp(),
        loadHealth(),
      ]);
      if (!overview.data || !daily.data) return <Failed what="money" error={overview.error ?? daily.error ?? "unknown"} />;
      const o = overview.data;
      return (
        <>
          <MoneySection o={o} i={insights.data} w={whatsapp.data} />
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Collected per day"
              sub="What clients paid through Balans, last 30 days"
              action={
                <div className="shrink-0 text-right">
                  <p className="font-display text-[1.35rem] leading-tight font-light tracking-[-0.025em] tabular-nums">
                    {naira(o.collected_30d_kobo)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/45">{naira(o.collected_24h_kobo)} in 24 hours</p>
                </div>
              }
            >
              <ColumnChart
                points={daily.data.map((d) => ({ label: dayMonth(d.day), value: d.collected_kobo }))}
                format={(v) => compactNaira(v)}
              />
            </Card>
            <InvoicesPaid o={o} />
          </div>
          <MetricsPanel m={health} whatsapp={whatsapp.data} users={o.users_onboarded} />
        </>
      );
    }

    case "usage": {
      const [overview, insights] = await Promise.all([loadOverview(), loadInsights()]);
      if (!overview.data) return <Failed what="usage" error={overview.error ?? "unknown"} />;
      if (!insights.data) {
        return (
          <Card className="mt-12">
            <Empty icon="filter">Insights not available yet.</Empty>
          </Card>
        );
      }
      return <UsageSection o={overview.data} i={insights.data} />;
    }

    case "whatsapp": {
      const [insights, whatsapp] = await Promise.all([loadInsights(), loadWhatsApp()]);
      return <WhatsAppSection w={whatsapp.data} i={insights.data} />;
    }
  }
}

/**
 * The older 30-day health panel, from `admin_metrics`. Kept because its
 * figures carry targets. Null when the view is not there, and the panel says
 * so rather than failing the page.
 */
async function loadHealth(): Promise<Metrics | null> {
  try {
    const { data, error } = await serviceClient().from("admin_metrics").select("*").single();
    if (error) return null;
    return data as Metrics;
  } catch {
    return null;
  }
}
