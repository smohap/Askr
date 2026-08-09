-- Askr — Phase 1 schema.
-- Money is integer cents. Timestamps are timestamptz, stored UTC.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type public.user_role as enum ('buyer', 'provider', 'admin');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.document_status as enum ('pending', 'approved', 'rejected');
create type public.document_type as enum ('identity', 'business', 'insurance', 'licence');
create type public.budget_mode as enum ('fixed', 'open');
create type public.urgency as enum ('standard', 'urgent');
create type public.request_visibility as enum ('public', 'private');
create type public.request_status as enum ('draft', 'published', 'awarded', 'completed', 'cancelled');
create type public.offer_status as enum ('active', 'withdrawn', 'accepted', 'rejected', 'expired');

create type public.order_state as enum (
  'pending_payment',
  'escrow_held',
  'in_progress',
  'awaiting_confirmation',
  'released',
  'refunded',
  'disputed',
  'cancelled'
);

create type public.order_actor as enum ('buyer', 'provider', 'admin', 'system', 'stripe_webhook');
create type public.dispute_status as enum ('open', 'resolved');
create type public.dispute_resolution as enum ('released', 'refunded');

-- ---------------------------------------------------------------- identity

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'buyer',
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Every auth user gets a profile. Role comes from signup metadata; anything other
-- than buyer/provider falls back to buyer, so 'admin' cannot be self-assigned.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    case new.raw_user_meta_data ->> 'role'
      when 'provider' then 'provider'::public.user_role
      else 'buyer'::public.user_role
    end,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- categories

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_phase1 boolean not null default false,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------- providers

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null,
  tagline text,
  about text,
  logo_url text,
  location_label text not null default '',
  lat double precision,
  lng double precision,
  service_radius_km integer not null default 15,
  verification_status public.verification_status not null default 'unverified',
  verification_reason text,
  stripe_account_id text,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  jobs_completed integer not null default 0,
  created_at timestamptz not null default now()
);

create index provider_profiles_verification_idx on public.provider_profiles (verification_status);

create table public.provider_categories (
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (provider_id, category_id)
);

create table public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  doc_type public.document_type not null,
  storage_path text not null,
  status public.document_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  review_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index provider_documents_provider_idx on public.provider_documents (provider_id);
create index provider_documents_status_idx on public.provider_documents (status);

-- ---------------------------------------------------------------- requests

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  title text not null,
  description text not null,
  -- category-conditional fields (vehicle make/model, guest count, ...)
  detail jsonb not null default '{}'::jsonb,
  budget_mode public.budget_mode not null default 'fixed',
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  needed_by timestamptz,
  location_label text not null default '',
  lat double precision,
  lng double precision,
  radius_km integer not null default 15,
  urgency public.urgency not null default 'standard',
  visibility public.request_visibility not null default 'public',
  status public.request_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint requests_fixed_budget_present
    check (budget_mode = 'open' or budget_cents is not null)
);

create index requests_buyer_idx on public.requests (buyer_id, created_at desc);
create index requests_status_idx on public.requests (status, published_at desc);
create index requests_category_idx on public.requests (category_id);

create table public.request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index request_media_request_idx on public.request_media (request_id);

-- Who the request was broadcast to. Written once at publish; it is both the
-- notification log and the predicate a provider's read access is granted through.
create table public.request_broadcasts (
  request_id uuid not null references public.requests (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  distance_km numeric(6, 2),
  notified_at timestamptz not null default now(),
  primary key (request_id, provider_id)
);

create index request_broadcasts_provider_idx on public.request_broadcasts (provider_id, notified_at desc);

-- ---------------------------------------------------------------- offers

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  price_cents integer not null check (price_cents > 0),
  description text not null,
  eta_minutes integer check (eta_minutes is null or eta_minutes >= 0),
  warranty_months integer not null default 0 check (warranty_months >= 0),
  terms text,
  expires_at timestamptz not null,
  status public.offer_status not null default 'active',
  created_at timestamptz not null default now()
);

-- A provider holds at most one live offer per request. Withdrawing frees the slot,
-- which is the whole negotiation mechanism in Phase 1 — there are no counter-offers.
create unique index offers_one_active_per_provider
  on public.offers (request_id, provider_id)
  where status = 'active';

create index offers_request_idx on public.offers (request_id, created_at desc);
create index offers_provider_idx on public.offers (provider_id, created_at desc);

create table public.offer_attachments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index offer_attachments_offer_idx on public.offer_attachments (offer_id);

-- ---------------------------------------------------------------- chat

-- A thread is (request_id, provider_id): the buyer talks to each provider separately.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  attachment_path text,
  mime_type text,
  created_at timestamptz not null default now(),
  constraint messages_not_empty check (body <> '' or attachment_path is not null)
);

create index messages_thread_idx on public.messages (request_id, provider_id, created_at);

-- ---------------------------------------------------------------- escrow

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete restrict,
  offer_id uuid not null unique references public.offers (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.provider_profiles (id) on delete restrict,
  state public.order_state not null default 'pending_payment',
  service_fee_cents integer not null check (service_fee_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  total_cents integer not null check (total_cents > 0),
  commission_cents integer not null check (commission_cents >= 0),
  currency text not null default 'nzd',
  stripe_payment_intent_id text unique,
  stripe_transfer_id text,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_is_sum check (total_cents = service_fee_cents + platform_fee_cents)
);

create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_provider_idx on public.orders (provider_id, created_at desc);
create index orders_state_idx on public.orders (state);

-- Append-only. The order's current state is reconciled against the latest row.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  from_state public.order_state,
  to_state public.order_state not null,
  actor public.order_actor not null,
  actor_id uuid references public.profiles (id),
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, id);

-- Append-only is enforced at the table, not in RLS: RLS does not apply to the
-- service role, and the ledger has to hold against every connection.
create function public.block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'order_events is append-only (attempted %)', tg_op;
end;
$$;

create trigger order_events_no_update
  before update or delete on public.order_events
  for each row execute function public.block_mutation();

-- orders.state may only move through public.apply_order_transition, which sets the
-- transaction-local flag below. Anything else editing state is a bug, including
-- service-role code, so it is refused at the table.
create function public.guard_order_state()
returns trigger
language plpgsql
as $$
begin
  if new.state is distinct from old.state
     and coalesce(current_setting('askr.in_transition', true), '') <> 'on' then
    raise exception 'orders.state must change through apply_order_transition (% -> %)',
      old.state, new.state;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_state_guard
  before update on public.orders
  for each row execute function public.guard_order_state();

-- The atomic tail of a transition. Whether from -> to is legal, and whether this
-- actor may make that move, is decided in src/lib/escrow/machine.ts; this function
-- re-checks the from-state under a row lock so two callers cannot both move an
-- order, and writes the state change and its ledger row in one transaction.
create function public.apply_order_transition(
  p_order_id uuid,
  p_from_state public.order_state,
  p_to_state public.order_state,
  p_actor public.order_actor,
  p_actor_id uuid,
  p_reason text,
  p_payload jsonb default '{}'::jsonb,
  p_patch jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  if v_order.state <> p_from_state then
    raise exception 'order % is %, expected % — transition rejected',
      p_order_id, v_order.state, p_from_state;
  end if;

  perform set_config('askr.in_transition', 'on', true);

  update public.orders
  set state = p_to_state,
      stripe_payment_intent_id = coalesce(p_patch ->> 'stripe_payment_intent_id', stripe_payment_intent_id),
      stripe_transfer_id = coalesce(p_patch ->> 'stripe_transfer_id', stripe_transfer_id),
      stripe_account_id = coalesce(p_patch ->> 'stripe_account_id', stripe_account_id)
  where id = p_order_id
  returning * into v_order;

  perform set_config('askr.in_transition', 'off', true);

  insert into public.order_events (order_id, from_state, to_state, actor, actor_id, reason, payload)
  values (p_order_id, p_from_state, p_to_state, p_actor, p_actor_id, p_reason, coalesce(p_payload, '{}'::jsonb));

  return v_order;
end;
$$;

-- Stripe event ids, inserted before the event is handled. The insert failing on
-- the primary key is the idempotency check.
create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  raised_by uuid not null references public.profiles (id),
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution public.dispute_resolution,
  resolution_reason text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index disputes_one_open_per_order
  on public.disputes (order_id)
  where status = 'open';

create index disputes_status_idx on public.disputes (status, created_at desc);

-- ---------------------------------------------------------------- reviews

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  request_id uuid not null references public.requests (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '',
  reply_body text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index reviews_provider_idx on public.reviews (provider_id, created_at desc);

create function public.refresh_provider_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid := coalesce(new.provider_id, old.provider_id);
begin
  update public.provider_profiles p
  set rating_avg = coalesce(agg.avg_rating, 0),
      rating_count = coalesce(agg.n, 0)
  from (
    select avg(rating)::numeric(3, 2) as avg_rating, count(*) as n
    from public.reviews
    where provider_id = v_provider
  ) agg
  where p.id = v_provider;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update of rating or delete on public.reviews
  for each row execute function public.refresh_provider_rating();

-- ---------------------------------------------------------------- notifications

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- geo

-- Great-circle distance in km. Immutable so it can be used in indexes and policies.
create function public.distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  end;
$$;

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.offers;
alter publication supabase_realtime add table public.order_events;
alter publication supabase_realtime add table public.request_broadcasts;
