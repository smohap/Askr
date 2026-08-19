# Feature status

Checked against `PRD/servuber-prd.html` and `PRD/servuber-mockup.html` (v1.1),
2026-08-19. Supersedes the feature reading taken from `askr-prd.html`.

## What changed in the updated documents

**Phase 1 scope did not change.** The eleven Phase 1 pills in the updated
roadmap are identical to the original. Nothing built so far is invalidated, and
nothing has been added to the MVP.

**Design tokens did not change.** The `:root` block in the updated mockup is
byte-identical to the original, so `src/styles/tokens.css` stands.

**A new PRD section 10, "v1.1 — fulfilment & trust additions"**, adds six
features benchmarked against on-demand home-services apps. The roadmap places
**all six in Phase 2**.

**The mockup grew from 9 screens to 10**, and four of those screens now show
v1.1 features inline. See the conflict note below.

## Phase 1 — the MVP

| Feature | Status | Where |
|---|---|---|
| Sign up / login | Built | `src/app/(auth)/`, `src/proxy.ts` |
| Create request | Built | `src/app/(buyer)/requests/new/` |
| Upload photos | Built | request-media bucket, uploaded post-insert |
| Set budget | Built | fixed or open, integer cents |
| Receive & compare offers | Built | `OfferStack`, `/requests/[id]/compare` |
| Chat | Built | `src/components/chat/`, Realtime per (request, provider) |
| Accept / reject | Built | `src/lib/orders/create.ts` |
| Escrow payment | Built | `src/lib/stripe/`, `src/lib/escrow/settle.ts`, `/api/stripe/webhook`, `/orders/[id]` |
| Ratings | Built | `/orders/[id]/review`, `/provider/reviews` with right of reply |
| Provider profile & offers | Built | `src/app/(provider)/` |
| Admin verification & disputes | Built | `src/app/(admin)/` |

Phase 1 is feature-complete. Steps 7, 8, 10 and 11 all landed, and the
`/orders/[id]/pay` route that accepting an offer redirected to now exists.

What is *not* proven: no migration in this repo has ever run against a
Postgres, and the Playwright suite has never executed — it needs a live
database, Stripe test keys and `stripe listen` forwarding to the webhook. See
`progress.txt` for the order to tackle that in.

## v1.1 additions — all Phase 2, none built

| Feature | What it is | Notes for when it is built |
|---|---|---|
| **Instant · Scheduled · Recurring** | Fulfilment-speed toggle. Instant skips offer comparison entirely and auto-matches the top-ranked available provider at a flat rate. | The largest of the six. Instant is a *second* fulfilment path, not a variation on the first — it bypasses the offer stack, which is the core loop. Needs flat-rate pricing per category, provider availability, and an auto-accept that creates an order with no offer behind it. `orders.offer_id` is currently `not null unique`. |
| **Task-stacking** | Several line items in one request — clean, laundry, ironing — quoted and completed together. | `requests` currently holds one title/description/budget. Needs a `request_items` child table; offers would price the basket, not the request. |
| **Auto-reassignment** | On provider cancel or no-show, re-offer to the next-best provider from the original offer set. | Depends on the Best match ranking already in `src/lib/offers/best-match.ts`. Needs new escrow transitions — currently nothing moves an order backwards out of `in_progress`, and that is deliberate, so the state machine would need edges added and documented. |
| **Tiered cancellation** | Free cancellation until a set window, then a late fee compensating the reserved slot. Shown at accept time. | Interacts directly with escrow: a late cancel is a partial refund, which the current machine has no state for. `refunded` is all-or-nothing today. |
| **Servuber Verified sessions** | Optional paid tier for in-home jobs. Recorded, encrypted, face-blurred, released only to the buyer and only in an active dispute, deleted after a fixed window (48h in the mockup). Two-stage consent: before payment, and again by OTP on arrival. | The heaviest item by far, and not merely a feature. Recording people in their homes carries privacy obligations under the NZ Privacy Act 2020 — collection notice, retention limits, access rights, and a lawful basis. Treat as a separate project with its own review, not a sprint item. |
| **Provider acquisition funnel** | A dedicated "Become a Provider" path plus a referral program for providers recruiting providers. | Mostly additive: a marketing route and a referral code on `provider_profiles`. The cheapest of the six to deliver. |

## Conflict: the mockup shows Phase 2 inside the Phase 1 flow

The updated mockup puts v1.1 features into the buyer journey:

- Screen 02 — task basket with "+ Add another task"
- Screen 03 — **new** fulfilment-speed screen, defaulting to Instant
- Screen 08 — Servuber Verified toggle (+$12) and the cancellation policy
- Screen 09 — "Simulate Pro no-show" for auto-reassignment

The PRD roadmap places every one of these in Phase 2. The build brief resolves
this: *the PRD wins on behaviour, the mockup wins on visual design.* So Phase 1
behaviour is unchanged, and the mockup is read here as a picture of the v1.1
destination rather than of the MVP.

The practical consequence is screen renumbering. Mockup screens 04–10 are the
old 03–09, so any reference to "mockup screen N" in commits or `progress.txt`
predating this file is off by one from screen 03 onward.

**Recommendation.** Finish Phase 1 as scoped — steps 7, 8, 10, 11 — before
opening any of the six. Instant fulfilment is the one worth arguing about
early, because it is a second core loop rather than an addition to the first,
and knowing it is coming would change how `orders` is shaped. If Instant is
genuinely near-term, decide it before step 7 sets the Stripe integration in
place.
