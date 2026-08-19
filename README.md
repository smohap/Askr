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

## Status

Step 1 of 11 is complete — scaffold, tokens, schema, RLS, storage, seed, and the
escrow state machine with 27 passing unit tests. The screens, auth, offers, chat,
Stripe integration, reviews, provider dashboard and admin console are not built
yet. `progress.txt` is the current state of play.
