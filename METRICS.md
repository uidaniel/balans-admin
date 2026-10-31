# Balans — unit economics and running costs

Last updated 31 October 2026.

Every figure below comes from one model with one set of inputs, stated in §3.
Where something is a guess it says so, because the difference matters: the
guesses are the parts that will turn out wrong, and the dashboard exists to
replace them.

> **What changed since the 22 September version.** Pro went from ₦4,000 to
> **₦3,000 a month** (26 September), with a **₦30,000 year** beside it
> (9 October). Since 3 October **naira invoices are paid straight into the
> user's own bank account**, with no processor and no fee, and **Paystack is
> the only processor**. Free stopped being an allowance
> and became a **one-time trial of 3 documents** (19 October). Card payments
> from abroad carry a **flat ₦1,000 Balans fee** (20 October). The old model
> earned a 1% fee on every Free invoice; there is no such fee now, so every
> table below has been recomputed, and most of the old ones no longer apply.

---

## 1. What Balans charges

| | Free trial | Pro |
|---|---|---|
| Price | ₦0 | **₦3,000 / month**, or **₦30,000 / year** (₦2,500 a month) |
| Documents | The first **3, ever** — not a month | Unlimited |
| Features | Every Pro feature | Logo and brand colour, all 20 designs, client reminders by email and WhatsApp (due date, 3 and 7 days late), the invoice sent to the client on WhatsApp, foreign currencies |
| Naira invoice, paid by transfer | **No fee** | **No fee** |
| Card payment from abroad | ₦1,000 to Balans, plus Paystack's 3.9% + ₦100 | Same |

A trial document is any invoice, quote or payment request sent; a cancelled
one still counts. After the third, a new document needs Pro. Everything
already sent keeps working and stays payable.

Pro does not renew by itself. The user is reminded before it ends and pays
again; when a period runs out there is a 7-day grace week before new
documents need Pro again.

Source: `api/src/config.ts` (`defaults.plans`, `defaults.international`),
`api/src/billing/subscription.ts`, `api/src/chat/knowledge.ts`.

### How the money moves

**Naira invoices never pass through Balans.** The client transfers straight
into the bank account the user gave during setup. There is no processor in
the middle and nothing for Balans to take, on either plan. The client pays
their own bank's transfer fee.

**Card payments from abroad go through Paystack.** Paystack charges 3.9% +
₦100 a payment; the user can pass that to their client in the invoice form.
Balans's ₦1,000 is always the user's, taken out of what they receive and
never added to the client's charge. Paystack collects it as the transaction
charge, so it never passes through the user's hands. The Paystack rates are
tagged as assumed in the International PRD until a real settlement has been
reconciled against them.

**Pro is charged through Paystack** (card, bank transfer and the other
methods Paystack offers), monthly or yearly.

So Balans has exactly two sources of revenue: **Pro subscriptions**, and
**₦1,000 per card payment from abroad**. Invoice size and payment rate earn
nothing directly.

---

## 2. What it costs to run

### Per-use costs

| Item | Cost | Notes |
|---|---|---|
| WhatsApp | **As Meta charges it** | Read from Meta since 30 October 2026 (API migration 0051) |
| Claude parser call | ~₦3 | Guess: ~1,030 input + ~150 output tokens |
| Paystack on a Pro payment | ~₦145 on ₦3,000; ~₦550 on ₦30,000 | Paystack's published local rate, 1.5% + ₦100. **To confirm** against a real settlement |
| Paystack on a card payment from abroad | ₦0 to us | Borne by the user (or passed to their client) |
| Naira invoice payments | ₦0 | No processor |
| PDF render | ₦0 | Our own headless Chrome |

**WhatsApp is measured, not estimated.** The Overview's WhatsApp card shows
what Meta charged over 30 days, from its pricing analytics, and every message
Meta priced, billable or free, from its delivery reports. Spend lags a day
and the card says how far it goes. The old fixed per-message estimate
(`messages.cost_estimate_kobo`, ₦14.50 a message) is still what
`admin_metrics.message_cost_naira_30d` adds up, but the dashboard no longer
shows it.

### Fixed monthly costs

Estimates from September; replace them with the real bills.

| | Lean | Full |
|---|---|---|
| Application server | ₦16,000 | ₦32,000 |
| Supabase | ₦0 (free tier) | ₦40,000 (Pro) |
| Resend email | ₦0 (to 3,000/mo) | ₦32,000 |
| Domain | ₦1,700 | ₦1,700 |
| **Total** | **₦18,000** | **₦105,000** |

Assumes ₦1,600 to the dollar. The API now runs on its own server, in Docker
behind Caddy and Cloudflare, deployed from `main` (`api/deploy/`), not on a
laptop.

---

## 3. What one user is worth, per month

| | Revenue | Less Paystack | **Net, before WhatsApp and the parser** |
|---|---|---|---|
| Free trial | ₦0 | — | **₦0** — a one-time acquisition cost |
| Pro, monthly | ₦3,000 | ~₦145 | **~₦2,855** |
| Pro, yearly | ₦2,500 (₦30,000 ÷ 12) | ~₦46 (₦550 ÷ 12) | **~₦2,454** |
| Each card payment from abroad | ₦1,000 | — | **₦1,000**, on either plan |

**A trial user earns nothing and costs the messages for setup and up to three
documents, once.** There is no ongoing Free tier to subsidise: after three
documents they either pay or stop sending. What a trial user costs in
WhatsApp is now a real number on the dashboard rather than a guess.

**A Pro user's worth does not depend on what they bill.** With no fee on naira
invoices, neither invoice size nor payment rate moves revenue. They matter
because they decide whether the user renews (§6).

The yearly plan is about 14% less a month, paid up front, with one renewal
decision a year instead of twelve.

---

## 4. Break-even

In Pro subscribers, since nothing else recurs. Before WhatsApp and the
parser, and before any card fees from abroad.

| Fixed costs | All monthly (~₦2,855) | All yearly (~₦2,454) |
|---|---|---|
| **₦18,000 (lean)** | **7** | **8** |
| ₦50,000 | 18 | 21 |
| ₦80,000 | 29 | 33 |
| ₦105,000 (full) | 37 | 43 |

**Fixed costs set break-even, not message costs.** Staying on free tiers
longer is still the biggest lever entirely in our control.

---

## 5. Scale

On the monthly plan's ~₦2,855, fixed costs a guess that grows with users:

| Pro subscribers | Net from Pro | Fixed | **Net / month** |
|---|---|---|---|
| 10 | ₦28,550 | ₦18,000 | +₦10,550 |
| 50 | ₦142,750 | ₦50,000 | +₦92,750 |
| 100 | ₦285,500 | ₦80,000 | +₦205,500 |
| 250 | ₦713,750 | ₦120,000 | +₦593,750 |
| 500 | ₦1,427,500 | ₦150,000 | +₦1,277,500 |

Before WhatsApp, which grows with every user, trial or Pro.

### To reach ₦1,000,000 net per month

At ₦150,000 fixed: **~403 Pro subscribers** if all are monthly, **~469** if
all are yearly. Call it **400–470**.

How many sign-ups that takes depends on how many who finish setup end up
paying. At 10%, about 4,000–4,700 users; at 20%, about 2,000–2,350.

---

## 6. What to track

### The health checks

From the `admin_metrics` view
(`api/src/db/migrations/0012_admin_metrics.sql`). Rolling 30 days.

| Metric | Target | Why |
|---|---|---|
| **Pro conversion** | **>10%**; plan on 8–10%, 15% is a stretch | Share of active users on Pro. It is the only recurring revenue there is |
| **Active users** | — | Active = sent a document in 30 days, shown against all users. A user who never sends one is a cost |
| **Invoices per Pro user** | >8/month | Under five, ₦3,000 is buying little they use, and Pro does not renew by itself. That is churn arriving |
| **Payment rate** | >70% | Earns nothing directly. It is whether Balans works for them, and so whether they renew |
| **Average invoice** | >₦20,000 | Earns nothing directly either. It says who Pro is for: people billing enough that ₦3,000 is small beside it |
| **Pro churn** | <5%/month | At 250 subscribers, 10% churn means replacing 25 a month to stand still |

Two caveats in the view's definitions: `docs_per_pro_user` divides **every**
user's documents in the window by the number of Pro users, not only Pro
users' documents; and `fees_earned_naira_30d` is everything in `fee_ledger`,
subscriptions included.

### What a user is

**A user is somebody who finished setup**: `consented_at` set and not
deleted (`admin_overview.users_onboarded`). The Overview's Users figure, its
"finished setup in the last 24 hours" and its bars (setups finished per Lagos
day, by `consented_at`) count that, and so does the health checks' "of N"
beside active users. Somebody who started and stopped is not a user; the
Users page hides them until "Show unfinished" is pressed, and the funnel's
first step counts them.

### The funnel

From `admin_insights` (`api/src/db/migrations/0028_admin_insights.sql`),
except step 3, every count over users not deleted. Each step is against the
one before.

1. **Started setup** — a `users` row: everybody who began, finished or not.
2. **Finished setup** — `consented_at` set. Setup is business name, bank
   account, then agreeing to the terms; the bank account can be skipped and
   added later.
3. **Added bank account** — finished setup and has somewhere to be paid: a
   `bank_accounts` row with status `active` (setup's account stays `pending`
   until it is confirmed, and that does not count), or, for somebody paid
   from abroad to details of their own, `abroad_pay_by = 'own'` with
   non-empty `payment_details`, since they have no Nigerian account and need
   none. Not in `admin_insights`: the Overview counts it from the tables
   (`loadSetup`) and leaves the step out if that read fails.
4. **Sent a document** — at least one non-draft, non-sample document.
5. **Got paid** — an invoice or payment request with something paid on it.
6. **Paid for Pro** — a subscription with money collected.

The Users page marks a set-up account with neither as **No bank yet**.

**Email verified is not a step.** It is asked after the first invoice and
confirmed by a link, so the Overview shows it beside the funnel: users who
finished setup and have `email_verified_at`, and that as a share of everyone
who finished setup.

### Setup nudges

Somebody who stops part-way through setup gets two touches
(`api/src/jobs/setup-nudges.ts`, migration 0050), counted on the Overview
from `users`:

- **Chat nudges** — `setup_nudge_at` set: one message in the chat a few
  hours after they went quiet. **Finished after** = `activated_setup_at`
  later than `setup_nudge_at`.
- **Follow-ups** — `setup_followup_at` set: the `setup_reminder` template and
  an email, two days on. **Finished after** = `activated_setup_at` later than
  `setup_followup_at`.
- **Still not set up** — `consented_at` empty, split by whether either nudge
  has gone.

Both stamps are set when the job picks somebody, before the send, so a nudge
that WhatsApp then would not deliver (the 24-hour window closed) still
counts.

### For the campaigns

Pro lifetime value at 12 months, **net of Paystack**: 12 × ₦2,855 =
**₦34,260** monthly, or ₦29,450 for a year paid up front. Before WhatsApp.

At ₦1,500 per sign-up and 10% conversion, a Pro user costs ~₦15,000 to
acquire:

- **Payback: ~5.3 months** on the monthly plan; on the yearly plan the first
  payment covers it.
- **LTV : CAC ≈ 2.3 : 1** monthly, **2.0 : 1** yearly.

A sign-up who never upgrades returns nothing: three documents of WhatsApp
and the ₦1,500 it took to find them.

**The metric that decides whether ad spend works is cost per *Pro* user, not
cost per sign-up.**

---

## 7. What would change these numbers

Ranked:

1. **Pro conversion.** It is the whole of recurring revenue. 10% → 20% halves
   the users needed for ₦1M.
2. **Fixed costs.** ₦18,000 rather than ₦80,000 moves break-even from 29 Pro
   subscribers to 7.
3. **Monthly against yearly.** Yearly is ~14% less a month but paid up front
   and renewed once.
4. **Card payments from abroad.** ₦1,000 each, on either plan; small until
   clients abroad are common.
5. **WhatsApp pricing.** Every trial user costs it and earns nothing, so it
   matters most where conversion is low.

### Savings already taken

- Invoice send cut from 4 messages to 3 (22 Sep 2026).
- The receipt rides inside the payment notice, one message with an
  attachment.

### Still available

- Prompt caching on the parser would cut its cost ~90%. Small, and trivial.

---

## 8. Health warning

Every behavioural number here — conversion, monthly against yearly, invoices
per user, what WhatsApp costs a trial user — is an **assumption** until the
dashboard says otherwise. The Paystack rates are published rates, not yet
reconciled against a real settlement.

The dashboard exists to replace these guesses with measurements. Twenty real
users will improve or discard most of this page, and that is the point.
