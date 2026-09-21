# Balans — unit economics and running costs

Last updated 22 September 2026.

Every figure below is either read from the code or derived from stated
assumptions. Where something is a guess it says so, because the difference
matters: nobody has used Balans yet, and the guesses are the parts that will
turn out wrong.

---

## 1. What Balans charges

| | Free | Pro |
|---|---|---|
| Subscription | ₦0 | **₦4,000 / month** |
| Fee on a paid invoice | 1%, min ₦100, cap ₦1,000 | 0.5%, min ₦50, cap ₦500 |
| Invoices | 5 / month | Unlimited |
| Invoice designs | 2 | 8 |
| Logo on invoices | — | Yes |
| Reminders to the client | — | Automatic email |

Source: `api/src/config.ts`.

### The fact the whole model rests on

**Monnify's 1.5% comes out of the user's share, not ours.**

`settle()` computes `userReceives = clientPays − processorFee − ours`, and the
split sets `feeBearer: true` on the user's sub-account. Our fee is therefore
**gross revenue with nothing deducted from it**.

If this were ever changed so that Balans bore the processor fee, the business
would be underwater on every invoice under about ₦7,000. It is worth
re-checking whenever the split logic is touched.

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

> **The 1 October 2026 change.** Free-form replies inside the 24-hour window
> were free from 1 July 2025. From 1 October 2026 Meta charges for them, and
> for utility templates sent in-window, with no free allowance. Meta's wording:
> *"Any non-template message is charged as of October 1, 2026."* Every figure
> in this document assumes the post-October price. Before that date, real costs
> are roughly six times lower.
>
> The Nigeria rate is from secondary sources; Meta publishes rate cards as
> CSV/PDF. **Confirm against WhatsApp Manager billing.**

### Messages per invoice

| Step | Messages |
|---|---|
| Draft summary | 1 |
| Document with caption | 1 |
| "I will tell you when it is paid" | 1 |
| Payment notice | 1 (if paid) |
| Receipt | 1 (if paid) |
| Overdue nudge | 1 (if unpaid, Free only) |

At a 70% payment rate: **≈ ₦69 per invoice attempt**, including the parser.

Onboarding costs **₦84** once per user (6 messages).

### Fixed monthly costs

| | Lean | Full |
|---|---|---|
| Application host (Fly / Railway / VPS) | ₦16,000 | ₦32,000 |
| Supabase | ₦0 (free tier) | ₦40,000 (Pro) |
| Resend email | ₦0 (to 3,000/mo) | ₦32,000 |
| Domain | ₦1,700 | ₦1,700 |
| **Total** | **₦18,000** | **₦105,000** |

Assumes ₦1,600 to the dollar. Adjust and everything here moves.

> **Not currently paid.** The API runs on a laptop behind a Cloudflare tunnel.
> That is not a production posture and must be replaced before any spend on
> acquisition.

---

## 3. What one user is worth, per month

Assumptions — **these are guesses**, and the first two matter most:

- Average invoice **₦20,000**
- **70%** of invoices get paid
- Free user sends **3** invoices/month; Pro sends **12**

| | Revenue | Message + parser cost | **Net** |
|---|---|---|---|
| Free user | ₦420 | ₦228 | **₦192** |
| Pro user | ₦4,840 | ₦816 | **₦4,024** |

**A Pro user is worth 21 Free users.**

### How sensitive that is to invoice size

| Average invoice | Free user net | Pro user net |
|---|---|---|
| ₦10,000 | **−₦18** | ₦3,604 |
| ₦15,000 | ₦87 | ₦3,814 |
| ₦20,000 | ₦192 | ₦4,024 |
| ₦30,000 | ₦402 | ₦4,444 |
| ₦50,000 | ₦822 | ₦5,284 |

**A Free user breaks even at about ₦10,900.** Below that they cost money every
month. This makes the Free tier a customer-acquisition channel rather than a
revenue line — a reasonable strategy, but a deliberate one.

The minimum fee stays at ₦100 on the judgement that 75%+ of transactions will
be above ₦10,000. Even if *every* invoice were below ₦10,000, the blend is
break-even rather than loss-making at a 70% payment rate.

---

## 4. Break-even

Contribution per 10 users at 90% Free / 10% Pro: **≈ ₦12,550**.

| Fixed costs | Users to break even |
|---|---|
| ₦20,000 (lean) | **~16** |
| ₦50,000 | ~40 |
| ₦80,000 | **~64** |
| ₦105,000 (full) | ~84 |

Or, ignoring Free users entirely: **₦80,000 ÷ ₦4,024 ≈ 20 Pro subscribers.**

**Fixed costs set break-even, not message costs.** Even if every WhatsApp
message were free, break-even at ₦80,000 fixed would still be ~53 users.
Staying on free tiers longer is the single biggest lever available.

---

## 5. Scale

At 90% Free / 10% Pro, ₦20,000 average invoice:

| Users | Contribution | Fixed | **Net / month** |
|---|---|---|---|
| 50 | ₦63,000 | ₦80,000 | −₦17,000 |
| 100 | ₦126,000 | ₦80,000 | +₦46,000 |
| 500 | ₦628,000 | ₦120,000 | +₦508,000 |
| 1,000 | ₦1,255,000 | ₦150,000 | +₦1,105,000 |

### To reach ₦1,000,000 net per month

| Pro conversion | Total users | Pro users |
|---|---|---|
| 10% | 2,086 | 209 |
| 15% | 1,565 | 235 |
| 20% | 1,252 | 250 |
| 30% | 894 | 268 |

The Pro count barely moves. The target is effectively:

> **~250 Pro subscribers.**

Conversion rate decides how many total users you must find to get them, not how
many subscribers you need.

---

## 6. The six metrics to track

On the admin dashboard, from the `admin_metrics` view
(`api/src/db/migrations/0012_admin_metrics.sql`). Rolling 30 days.

| Metric | Target | Why |
|---|---|---|
| **Pro conversion** | >15% | The whole model. Below 10%, ₦1M needs 2,500 users |
| **Active users** | — | Active = sent something. A signup who never invoices is a cost |
| **Invoices per Pro user** | >8/month | Under 5 they are paying ₦4,000 for what Free gives. Churn arriving |
| **Payment rate** | >70% | An unpaid invoice costs ~₦45 and earns nothing |
| **Average invoice** | >₦20,000 | Below ~₦11,000 Free users lose money |
| **Pro churn** | <5%/month | At 250 subscribers, 10% churn means replacing 25 a month to stand still |

### For the campaigns

Pro lifetime value at 12 months ≈ **₦58,000**. At ₦1,500 per signup and 15%
conversion, a Pro user costs ~₦10,000 to acquire — **payback in ~2.2 months**.

A signup who never upgrades returns ₦192/month against ₦1,500 acquired —
**7.8 months to break even**.

**Therefore the metric that decides whether ad spend works is cost per *Pro*
user, not cost per signup.**

---

## 7. What would change these numbers

Ranked by how much:

1. **Fixed costs.** Halving them halves break-even. Entirely in our control.
2. **Average invoice size.** ₦50,000 instead of ₦20,000 makes a Free user worth
   ₦822 instead of ₦192 — roughly halving the users needed for ₦1M.
3. **Pro conversion.** 10% → 30% cuts users needed by 57%.
4. **WhatsApp pricing.** Material at scale (±₦250,000/month at 1,000 users) but
   it barely moves break-even.

### Cheap engineering savings not yet taken

- Folding the "I will tell you the moment it is paid" note into the document
  caption saves **₦14.50 per invoice** — 21% of the send cost. Currently a
  separate message by deliberate product choice.
- Prompt caching on the parser would cut its cost ~90%. Small but trivial.

---

## 8. Health warning

Every behavioural number here — average invoice, payment rate, invoices per
user, conversion — is an **assumption**. At the time of writing there are 4
users and 9 documents in the database, all from testing.

The purpose of the dashboard is to replace these guesses with measurements as
soon as real users arrive. Until then, treat this as a model of how the
business works, not a forecast of what it will earn.
