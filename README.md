# Servuber

**Service at your choice of price.**

A demand-first marketplace for New Zealand. A buyer posts one request — a job, a
product, a booking — sets their price, and verified providers compete with offers
within minutes. Four roles share one request object: guest, buyer, provider, admin.

Phase 1 (MVP) scope: sign up, create request, upload photos, set budget, receive
and compare offers, chat, accept/reject, escrow payment, ratings, provider profile
and offers, admin verification and disputes.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router) · TypeScript · Tailwind v4 |
| Data | Supabase Postgres, RLS on every table, schema `askr` |
| Auth | Supabase Auth (email + magic link) |
| Files | Supabase Storage, five buckets |
| Live | Supabase Realtime — chat, offer feed, escrow timeline |
| Money | Stripe Connect (NZ, Express), test mode |
| Tests | Vitest (unit) · Playwright (end to end) |

## Running it

```bash
./init.sh
```

Installs, starts local Supabase, applies migrations and seed, runs the unit
tests, and starts the dev server. Needs Docker Desktop running and the Supabase
CLI installed. Use `./init.sh hosted` to push migrations to a linked hosted
project instead.

Seeded accounts all share the password `servuber-dev-password`:

| Account | Role |
|---|---|
| `buyer@servuber.test` | buyer |
| `admin@servuber.test` | admin |
| `sparkle@servuber.test` · `maidbright@servuber.test` · `bestclean@servuber.test` | verified providers |
| `freshstart@servuber.test` | pending provider, sits in the admin verification queue |

## Layout

```
src/styles/tokens.css      design tokens — the only file allowed a colour literal
src/lib/brand.ts           product name and tagline
src/lib/escrow/machine.ts  the escrow state machine, pure and exhaustively tested
src/lib/money.ts           integer-cent arithmetic, NZD and Pacific/Auckland formatting
src/lib/supabase/          three clients: browser, request-scoped server, service role
supabase/migrations/       schema, RLS, storage buckets, grants
e2e/                       Playwright — the buyer journey and the admin console
progress.txt               what is built, what is next, and why things are the way they are
```

## Two things that are easy to get wrong

**Escrow is a state machine, not a status column.** `src/lib/escrow/machine.ts`
holds the eleven legal transitions and who may make each one; it is pure, so the
tests enumerate all 64 state pairs. `askr.apply_order_transition()` is its atomic
tail — row lock, re-check the from-state, update the order and append to
`order_events` in one transaction. `order_events` refuses UPDATE and DELETE at the
table level, and `orders.state` cannot move by any other path, including from the
service role.

**Colour lives in exactly one file.** Every colour in the app references a token
from `src/styles/tokens.css`, mapped into Tailwind's `@theme`. A hex value or a
default Tailwind palette class (`bg-slate-900`, `text-gray-400`) anywhere else is
a bug.

## Tests

```bash
npm test          # unit — no database, no network
npm run e2e       # end to end — needs everything below
```

The Playwright suite stubs nothing. Before `npm run e2e`:

1. a Supabase instance with the migrations and seed applied (`./init.sh`)
2. Stripe test keys in `.env.local`
3. `stripe listen --forward-to localhost:3000/api/stripe/webhook`

The third is not optional. An order does not leave `pending_payment` on the
success redirect — only on the webhook — so without the listener the suite
hangs waiting for a state that never arrives. That is the behaviour under test.

Run `npm run e2e:install` once to fetch the browser.

## Status

Phase 1 is feature-complete: all eleven steps of the build order have landed.
`docs/feature-status.md` has the feature-by-feature reading against the v1.1
PRD, and `progress.txt` has the decisions and what is still unproven.

Two things are unproven and worth knowing before deploying. No migration in
this repo has ever executed against a Postgres — they were written without
Docker or the Supabase CLI on the build machine — and the Playwright suite has
never run, for the same reason plus the absence of Stripe keys.
