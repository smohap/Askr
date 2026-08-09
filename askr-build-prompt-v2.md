# Askr — Claude Code build prompt (Opus 5) · v2

<context>
You are building **Askr**, a demand-first ("reverse") marketplace for New Zealand. A buyer
posts one request — a job, a product, a booking — and verified providers compete with
offers within minutes. Four roles share one request object: Guest, Buyer, Provider, Admin.

Two files are attached and are the source of truth:

- `askr-prd.html` — product requirements. Sections 01–10 cover vision, roles, categories,
  the eleven-step request lifecycle, per-role features, the AI layer, trust & payments,
  revenue model, differentiators, and the phased roadmap.
- `askr-mockup.html` — a click-through of the buyer flow across nine screens, and the
  visual language the product ships with.

Read both before writing code. Where they disagree, the PRD wins on behaviour and the
mockup wins on visual design.
</context>

<scope>
Build **Phase 1 (MVP) only**, as listed in PRD section 10:

sign up / login · create request · upload photos · set budget · receive & compare offers ·
chat · accept / reject · escrow payment · ratings · provider profile & offers ·
admin verification & disputes

Everything in PRD Phases 2 and 3 is out of scope. Named explicitly, because these are the
ones most likely to look like natural extensions of Phase 1 work and get built anyway:

- **Counter-offers and negotiation flow.** An offer is accepted or rejected. There is no
  counter, no revised price, no negotiation state. If the buyer wants a different price
  they say so in chat and the provider withdraws and re-offers.
- **Saved / favourite providers, and direct invite to a named provider.** Requests
  broadcast to matching providers only.
- **Recurring or repeat requests.** Every request is one-shot; no schedule, no auto-repost.
- **Subscriptions, lead credits, featured/priority ranking, loyalty rewards.** No billing
  surface other than the escrow payment itself. Commission is a constant in config.
- **AI concierge, request rewriting, budget estimation, proposal writing, smart replies,
  scam detection, best-match ranking.** The PRD's entire section 06 is Phase 2. The buyer
  writes their own request text; ranking is the sort controls in step 5 and nothing more.
- **Group buying, partial fulfilment, split/milestone payments, team accounts, API.**
- **Auto-translate, voice notes, read receipts** in chat.

The "Best match" badge in the mockup's offer stack is Phase 1 only as a label on the
cheapest-with-highest-rating offer using a simple documented rule — not a model, not a
learned ranking.

Categories in Phase 1: Home Services, Automotive, Electronics, Education, Events, Other.
The other twelve PRD categories are seed rows, not routes. One request schema throughout;
category changes which optional fields render, never the flow.

If you believe something on this exclusion list is actually required to make Phase 1 work,
stop and say so in a sentence before building it.
</scope>

<stack>
- Next.js (App Router) + TypeScript, React Server Components where they fit
- Tailwind CSS; no component library — build the components from the mockup
- Supabase: Postgres, Auth (email + magic link), Storage for request media and provider
  documents, Realtime for chat and the live offer feed
- Row Level Security on every table, enforced by role. A buyer sees only their own
  requests and the offers on them; a provider sees published requests matching their
  service area plus their own offers; admin sees everything.
- Stripe Connect (NZ, Express accounts) for escrow: buyer pays a destination charge with
  manual capture or a held transfer; funds release to the provider only when the buyer
  confirms completion; platform commission taken on release. Test mode only.
- Zod for request/offer validation shared between client and server
- Playwright for the two end-to-end flows below

If a piece of this stack is a bad fit once you're into the code, say so in a sentence and
propose the swap before rewriting around it.
</stack>

<escrow>
Escrow is the part of this product that is expensive to get wrong, so build it as an
explicit state machine, not a status column that gets overwritten.

Two tables:

- `orders` — one row per accepted offer, holding the current state, the amounts in integer
  cents (service fee, platform fee, total, commission), and the Stripe identifiers.
- `order_events` — append-only. Every transition writes a row: order id, from-state,
  to-state, actor (buyer / provider / admin / system / stripe-webhook), reason, payload,
  timestamp. Rows are never updated or deleted. The order's current state is derived from,
  and reconciled against, the latest event.

States: `pending_payment` → `escrow_held` → `in_progress` → `awaiting_confirmation` →
`released` · `refunded` · `disputed` · `cancelled`.

Legal transitions, and nothing else:

1. `pending_payment` → `escrow_held` — Stripe payment intent succeeds (webhook, not the
   client redirect).
2. `pending_payment` → `cancelled` — payment fails or expires.
3. `escrow_held` → `in_progress` — provider marks started.
4. `in_progress` → `awaiting_confirmation` — provider marks delivered.
5. `awaiting_confirmation` → `released` — buyer confirms. Capture/transfer fires,
   commission is split, provider is paid.
6. `escrow_held` | `in_progress` | `awaiting_confirmation` → `disputed` — either party
   raises a dispute.
7. `disputed` → `released` | `refunded` — admin resolves, with a required reason.
8. `escrow_held` → `refunded` — buyer cancels before work starts.

Rules:

- Transitions happen in one server-side function that validates the from-state, the
  actor's right to make that move, and writes the event in the same transaction as the
  state change. No route handler mutates order state directly.
- Any transition not on the list above is rejected with an error, including
  `released` → anything. `released` and `refunded` are terminal.
- Stripe webhooks are idempotent on event id and are the only source of truth for money
  actually moving. The UI reflects state; it never asserts it.
- The buyer's status timeline in mockup screen 08 renders from `order_events`, not from a
  hardcoded list of steps.
</escrow>

<design>
The visual system comes from `askr-mockup.html`. Do not redesign it, and do not fall back
to generic dark-mode dashboard styling — that is the most likely way this build goes
wrong visually.

Before building any screen, extract the mockup's `:root` custom properties into a single
tokens file and import it globally. Every colour in the app references a token. If you
find yourself writing a hex value or a default Tailwind palette class (`bg-slate-900`,
`text-gray-400`, `bg-blue-600`) anywhere outside that tokens file, you have drifted —
stop and use the token.

- Palette: `--void` `--panel` `--panel-raised` `--grid` `--grid-soft` `--signal`
  `--signal-dim` `--amber` `--danger` `--text` `--muted` `--faint`. Near-black surfaces,
  one high-signal green accent. Keep `--signal` scarce: live state, best-match, and the
  single primary action on a screen. `--amber` is pending/warning, `--danger` is
  destructive or failed. Nothing else is coloured.
- Type: Space Grotesk for headings, Inter for body, IBM Plex Mono for every number,
  status, ID, price, distance, ETA and countdown. Lift the exact weights from the mockup.
- Mobile-first for the buyer flow — it is a phone product. Provider dashboard and admin
  console are desktop-first and may diverge in layout while using the same tokens,
  type scale, border treatment and spacing rhythm.
- Motion is functional only: offers landing in the live feed, escrow state transitions,
  the broadcasting screen. CSS where possible.

For the screens the mockup doesn't cover — provider dashboard, provider profile, admin
verification queue, dispute view — extend this language rather than introducing a second
one. Build them from the same primitives (panel, grid border, mono metric, signal accent)
that the buyer screens use.
</design>

<build_order>
Work in this sequence, committing at the end of each step so the history is a usable
state log.

1. Repo scaffold, environment config, design tokens file extracted from the mockup,
   Supabase schema and RLS migrations, seed data (categories, a few verified providers,
   one buyer, one admin).
2. Auth and role routing — guest, buyer, provider, admin. Guests browse public requests
   and nothing else.
3. Request creation: description, category with conditional fields, fixed or open budget,
   service date, location and radius, media upload, urgency, public/private, drafts.
4. Broadcast and matching: publish to providers whose category and service area match,
   notify them, show the buyer the live responding state.
5. Offers: submission (price, description, attachments, ETA, warranty, terms, expiry with
   visible countdown), the buyer's offer stack with sort by price / rating / ETA /
   distance, and the side-by-side comparison view.
6. Realtime chat on a request thread, with images and documents.
7. Escrow, per the `<escrow>` block above. Build the state machine and `order_events`
   first, then the Stripe integration against it, then the UI.
8. Ratings and reviews, with the provider's right of reply.
9. Provider side: business profile, verification document upload, offer history, dashboard
   with new requests / pending offers / won jobs / revenue / rating.
10. Admin: verification queue with approve/reject and reasons, dispute resolution on an
    escrowed order, basic platform reporting.
11. Playwright coverage of two paths end to end: buyer posts → provider offers → buyer
    accepts and pays → provider completes → buyer confirms and reviews; and admin verifies
    a provider then resolves a dispute with a refund. Add unit coverage of the transition
    function, including rejected illegal transitions.

Write `progress.txt` as you go with what is done, what is next, and any decision that
would be non-obvious to someone picking this up fresh. Keep an `init.sh` that installs,
migrates, seeds and starts the dev server so a fresh session can run the app without
rediscovering how.
</build_order>

<constraints>
Keep solutions minimal and direct. Only build what this brief asks for. No speculative
flexibility, no helpers for one-time operations, no error handling for cases that can't
occur — validate at the boundaries (user input, Stripe webhooks, uploads) and trust
internal code elsewhere. Comment only where the logic isn't self-evident.

Money is integer cents, never floats. Timestamps are UTC in the database and render in
Pacific/Auckland. Prices display as NZD.

Never speculate about code you haven't opened — read the file before changing it.

Tests verify correctness; they don't define it. If a test is wrong or a requirement is
infeasible, say so rather than weakening the test to pass.

Local, reversible actions — writing files, running migrations against the local database,
running tests — go ahead without asking. Ask before anything destructive or shared:
dropping tables on a remote database, force pushes, or anything touching live money.
Remove any scratch files you create for iteration.
</constraints>

<working_style>
Say in one sentence what you're about to do before your first tool call. While working,
give a brief update only when you finish a numbered step, hit a decision that changes the
shape of the build, or find something in the PRD that can't be built as written. Lead with
the outcome — what now works — then the detail.

Keep chat responses short. Match written docs to what the task needs; no padding sections
or restated summaries.

Deliver this scope, at this scope. Make routine judgment calls yourself and check in only
where two readings of the brief would produce materially different products. If something
here looks mistaken or you see a better approach, say so in a sentence and continue as
briefed rather than quietly changing the job.

Handle work yourself unless a step is genuinely large and parallelisable across
independent files; if you do delegate, one subagent is usually enough.
</working_style>

<first_response>
Before writing code, output: the data model (tables, key columns, relationships), the
escrow states and transitions as you'll implement them, and the route map by role. Roughly
a page. Then start at step 1.
</first_response>
