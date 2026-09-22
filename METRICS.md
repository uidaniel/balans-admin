# Balans — unit economics and running costs

Last updated 22 September 2026.

Every figure below comes from one model with one set of inputs, stated in §3.
Where something is a guess it says so, because the difference matters: nobody
has used Balans yet, and the guesses are the parts that will turn out wrong.

> **Correction from the previous version.** The break-even and scale tables
> carried figures derived from a ₦50,000 average invoice into a document whose
> stated assumption is ₦20,000. Break-even at ₦80,000 fixed was given as 64
> users; on consistent inputs it is **137**. Everything below has been
> recomputed from a single model.

---

## 1. What Balans charges

| | Free | Pro |
|---|---|---|
| Subscription | ₦0 | **₦4,000 / month** |
| Fee on a paid invoice | 1%, min ₦100, cap ₦1,000 | **None** |
| Invoices | 5 / month | Unlimited |
| Invoice designs | 2 | 8 |
| Logo on invoices | — | Yes |
| Reminders to the client | — | Automatic email |

Source: `api/src/config.ts`.

### Pro takes no transaction fee

Changed from 0.5% on 22 September 2026. The fee was worth about ₦840 a month
from a user sending twelve invoices — a rounding error beside the ₦4,000
subscription — and it made the pitch conditional. "0.5% instead of 1%" is an
argument somebody has to do arithmetic to believe. "No fee" is a fact they can
check on their next invoice.

On a ₦350,000 invoice, measured against the live fee engine:

| | Balans takes | User receives |
|---|---|---|
| Free | ₦1,000 | ₦347,000 |
| **Pro** | **₦0** | **₦348,000** |

**Pro pays for itself at four invoices a month over ₦100,000**, where the Free
fee hits its ₦1,000 cap. At ₦50,000 invoices it takes eight. At ₦20,000, twenty.
The pitch therefore only works for people billing real money — which is the
same argument for aiming the campaigns at photographers, event vendors and
designers rather than at everyone.

### The fact the whole model rests on

**Monnify's 1.5% comes out of the user's share, not ours.** `settle()` computes
`userReceives = clientPays − processorFee − ours`, and the split sets
`feeBearer: true` on the user's sub-account. Our fee is gross revenue with
nothing deducted.

A zero fee means the split reserves the **entire** payment for the user's
sub-account. Monnify accepts this — tested against the sandbox on 22 September
2026, a ₦350,000 transaction reserving all ₦350,000 initialised and issued a
transfer account normally.

> **⚠ To confirm.** That was the sandbox. Sandboxes accept splits that
> compliance later questions, and a 100% reservation is unusual enough to be
> worth an explicit yes. Add it to the questions already going to Monnify
> support: *"Can a sub-account split reserve the full transaction amount, so
> that the merchant retains nothing, on a live account?"* If the answer is no,
> Pro needs a nominal fee — a ₦1 reservation would do — rather than zero.

Source: `api/core/fees.ts`.

---

## 2. What it costs to run

### Per-message costs

| Item | Cost | Notes |
|---|---|---|
| WhatsApp message (outbound) | **₦14.50** | ~$0.0101 + 7.5% VAT |
| WhatsApp message (inbound) | ₦0 | Never charged |
| Claude parser call | ~₦3 | ~1,030 input + ~150 output tokens |
| Monnify | ₦0 to us | Borne by the user |
| PDF render | ₦0 | Our own headless Chrome |

> **⚠ To confirm.** The Nigeria rate is from secondary sources; Meta publishes
> rate cards as CSV/PDF. Check WhatsApp Manager once the real number is live.
>
> **⚠ To confirm.** Monnify's 1.5% is their published card rate. Bank transfer
> may be priced differently and may cap differently. Get the real number from
> Monnify support before the fee engine is considered final — it changes what
> the *user* receives, not what we earn, but they will notice.

> **The 1 October 2026 change.** Free-form replies inside the 24-hour window
> were free from 1 July 2025. From 1 October Meta charges for them, and for
> utility templates sent in-window, with no free allowance. Meta's wording:
> *"Any non-template message is charged as of October 1, 2026."* Every figure
> here assumes the post-October price. Before that date, real costs are roughly
> six times lower.

### Messages per invoice

Reduced on 22 September 2026 from four to three, back to the PRD's budget.

| Step | Messages |
|---|---|
| Draft summary | 1 |
| Document — caption carries the link *and* "I will tell you when it is paid" | 1 |
| Payment notice, with the receipt attached | 1 (if paid) |
| Overdue nudge | 1 (if unpaid, Free only) |

The note used to be its own message so that nothing the user forwarded carried
it. That separation cost ₦14.50 on every invoice ever sent, so it now sits
below a rule in the caption where it plainly belongs to the sender.

The design picker is offered once, as a button, to a user who has never chosen
a design. After that `/design` is the way in.

At a 70% payment rate: **≈ ₦55 per invoice attempt**, including the parser.
Onboarding costs **₦84** once per user.

### Fixed monthly costs

| | Lean | Full |
|---|---|---|
| Application host (Fly / Railway / VPS) | ₦16,000 | ₦32,000 |
| Supabase | ₦0 (free tier) | ₦40,000 (Pro) |
| Resend email | ₦0 (to 3,000/mo) | ₦32,000 |
| Domain | ₦1,700 | ₦1,700 |
| **Total** | **₦18,000** | **₦105,000** |

Assumes ₦1,600 to the dollar.

> **🔴 Spend this first.** The API currently runs on a laptop behind a
> Cloudflare tunnel. This must be replaced **before the beta**, not before ad
> spend. A webhook missed because a laptop slept is a user who believes the bot
> lied to them about money, and that is not a bug you get to explain away.
> Fly or Railway's cheapest tier — about ₦16,000 — is the fix.

---

## 3. What one user is worth, per month

Inputs — **these are guesses**:

- Average invoice **₦20,000**
- **70%** of invoices paid
- Free user sends **3** invoices/month; Pro sends **12**

| | Revenue | Message + parser cost | **Net** |
|---|---|---|---|
| Free user | ₦420 | ₦154 | **₦266** |
| Pro user | ₦4,000 | ₦520 | **₦3,480** |

**A Pro user is worth 13 Free users.**

### Sensitivity to invoice size

| Average invoice | Free user net | Pro user net |
|---|---|---|
| ₦10,000 | ₦56 | ₦3,480 |
| ₦15,000 | ₦161 | ₦3,480 |
| ₦20,000 | ₦266 | ₦3,480 |
| ₦30,000 | ₦476 | ₦3,480 |
| ₦50,000 | **₦896** | ₦3,480 |

Two things follow.

**A Free user no longer loses money at any invoice size** — at a 70% payment
rate. Cutting the message count moved break-even below the ₦1,000 minimum
invoice, which removes the argument for raising the ₦100 minimum fee.

But the risk did not disappear; it moved. **A Free user's cost is flat at ₦154
a month whatever the payment rate**, because a paid invoice and an unpaid one
each cost exactly one extra message — the notice, or the nudge. Only the
revenue side moves. So the question is no longer how big the invoices are, it
is how many get paid:

| Average invoice | Fee earned | Free user goes negative below |
|---|---|---|
| ₦1,000 – ₦10,000 | ₦100 (the minimum) | **51% paid** |
| ₦20,000 | ₦200 | 26% paid |
| ₦50,000 | ₦500 | 10% paid |

**Watch the payment rate, not the invoice size.** If the dashboard shows it
sliding towards 50%, Free users on small invoices go negative before anything
else in this model does.

**Pro is now flat.** With no transaction fee, a Pro user is worth ₦3,480
whatever they bill. Larger invoices only improve the Free tier — which is
another reason the upgrade has to be sold on the 5-invoice cap, the designs,
the logo and the reminders rather than on fee savings.

---

## 4. Break-even

Contribution per 10 users at 90% Free / 10% Pro: **₦5,874**.

| Fixed costs | Users to break even |
|---|---|
| **₦18,000 (lean)** | **31** |
| ₦50,000 | 86 |
| ₦80,000 | 137 |
| ₦105,000 (full) | 179 |

Or ignoring Free users: **₦80,000 ÷ ₦3,480 ≈ 23 Pro subscribers.**
On the lean setup, **5**.

**Fixed costs set break-even, not message costs.** Staying on free tiers longer
is the single biggest lever available, and it is entirely in our control.

---

## 5. Scale

At 90% Free / 10% Pro, ₦20,000 average invoice:

| Users | Contribution | Fixed | **Net / month** |
|---|---|---|---|
| 50 | ₦29,370 | ₦18,000 | +₦11,370 |
| 100 | ₦58,740 | ₦50,000 | +₦8,740 |
| 500 | ₦293,700 | ₦80,000 | +₦213,700 |
| 1,000 | ₦587,400 | ₦120,000 | +₦467,400 |
| 2,000 | ₦1,174,800 | ₦150,000 | +₦1,024,800 |

### To reach ₦1,000,000 net per month

| Pro conversion | Total users | Pro users |
|---|---|---|
| **10% (plan for this)** | **2,043** | 204 |
| 15% (stretch) | 1,604 | 241 |
| 20% | 1,320 | 264 |
| 30% | 975 | 293 |

The Pro count barely moves. The target is effectively **~250 Pro subscribers**.
Conversion decides how many total users you must find to get them.

---

## 6. The six metrics to track

From the `admin_metrics` view
(`api/src/db/migrations/0012_admin_metrics.sql`). Rolling 30 days.

| Metric | Target | Why |
|---|---|---|
| **Pro conversion** | **8–10%**, 15% is a stretch | Typical freemium converts 2–5%. The 5-invoice cap should beat that, but do not build a budget on 15% |
| **Active users** | — | Active = sent something. A signup who never invoices is a cost |
| **Invoices per Pro user** | >8/month | Under 5 they are paying ₦4,000 for what Free gives. That is churn arriving |
| **Payment rate** | >70% | An unpaid invoice costs ~₦40 and earns nothing |
| **Average invoice** | >₦20,000 | Free-tier value scales almost linearly with it |
| **Pro churn** | <5%/month | At 250 subscribers, 10% churn means replacing 25 a month to stand still |

### For the campaigns

Pro lifetime value at 12 months, **net of what it costs to serve them**:
12 × ₦3,480 = **₦41,760**. Stated net rather than as 12 × ₦4,000 of revenue, so
it can be compared against acquisition cost without mixing gross and net.

At ₦1,500 per signup and 10% conversion, a Pro user costs ~₦15,000 to acquire:

- **Payback: ~4.3 months**
- **LTV : CAC = 2.8 : 1**

A signup who never upgrades returns ₦266/month against ₦1,500 acquired —
**5.6 months to break even**.

**The metric that decides whether ad spend works is cost per *Pro* user, not
cost per signup.**

---

## 7. What would change these numbers

Ranked:

1. **Fixed costs.** ₦18,000 rather than ₦80,000 moves break-even from 137 users
   to 31. Nothing else comes close, and it is entirely in our control.
2. **Average invoice size.** ₦50,000 rather than ₦20,000 more than triples a
   Free user. Points the campaigns at photographers, event vendors and
   designers billing ₦50k–₦500k, not at everyone.
3. **Pro conversion.** 10% → 30% cuts users needed for ₦1M by 52%.
4. **WhatsApp pricing.** Material at scale but barely moves break-even.

### Savings already taken

- Invoice send cut from 4 messages to 3 (22 Sep 2026) — **₦14.50 per invoice**,
  about 25% of the send cost.
- The receipt was already inside the payment notice as one message with an
  attachment.

### Still available

- Prompt caching on the parser would cut its cost ~90%. Small, and trivial.

---

## 8. Health warning

Every behavioural number here — average invoice, payment rate, invoices per
user, conversion — is an **assumption**. At the time of writing there are 4
users and 9 documents in the database, all from testing.

The dashboard exists to replace these guesses with measurements. Twenty real
users will improve or discard most of this page, and that is the point.
