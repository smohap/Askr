-- Askr — Phase 1 schema.
-- Money is integer cents. Timestamps are timestamptz, stored UTC.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type askr.user_role as enum ('buyer', 'provider', 'admin');
create type askr.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type askr.document_status as enum ('pending', 'approved', 'rejected');
create type askr.document_type as enum ('identity', 'business', 'insurance', 'licence');
create type askr.budget_mode as enum ('fixed', 'open');
create type askr.urgency as enum ('standard', 'urgent');
create type askr.request_visibility as enum ('public', 'private');
create type askr.request_status as enum ('draft', 'published', 'awarded', 'completed', 'cancelled');
create type askr.offer_status as enum ('active', 'withdrawn', 'accepted', 'rejected', 'expired');

create type askr.order_state as enum (
  'pending_payment',
  'escrow_held',
  'in_progress',
  'awaiting_confirmation',
  'released',
  'refunded',
  'disputed',
  'cancelled'
);

create type askr.order_actor as enum ('buyer', 'provider', 'admin', 'system', 'stripe_webhook');
create type askr.dispute_status as enum ('open', 'resolved');
create type askr.dispute_resolution as enum ('released', 'refunded');

-- ---------------------------------------------------------------- identity

create table askr.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role askr.user_role not null default 'buyer',
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Every auth user gets a profile. Role comes from signup metadata; anything other
-- than buyer/provider falls back to buyer, so 'admin' cannot be self-assigned.
create function askr.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = askr, extensions
as $$
begin
  insert into askr.profiles (id, role, full_name)
  values (
    new.id,
    case new.raw_user_meta_data ->> 'role'
      when 'provider' then 'provider'::askr.user_role
      else 'buyer'::askr.user_role
    end,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function askr.handle_new_user();

-- ---------------------------------------------------------------- categories

create table askr.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_phase1 boolean not null default false,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------- providers

create table askr.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references askr.profiles (id) on delete cascade,
  business_name text not null,
  tagline text,
  about text,
  logo_url text,
  location_label text not null default '',
  lat double precision,
  lng double precision,
  service_radius_km integer not null default 15,
  verification_status askr.verification_status not null default 'unverified',
  verification_reason text,
  stripe_account_id text,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  jobs_completed integer not null default 0,
  created_at timestamptz not null default now()
);

create index provider_profiles_verification_idx on askr.provider_profiles (verification_status);

create table askr.provider_categories (
  provider_id uuid not null references askr.provider_profiles (id) on delete cascade,
  category_id uuid not null references askr.categories (id) on delete cascade,
  primary key (provider_id, category_id)
);

create table askr.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references askr.provider_profiles (id) on delete cascade,
  doc_type askr.document_type not null,
  storage_path text not null,
  status askr.document_status not null default 'pending',
  reviewed_by uuid references askr.profiles (id),
  review_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index provider_documents_provider_idx on askr.provider_documents (provider_id);
create index provider_documents_status_idx on askr.provider_documents (status);

-- ---------------------------------------------------------------- requests

create table askr.requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references askr.profiles (id) on delete cascade,
  category_id uuid not null references askr.categories (id),
  title text not null,
  description text not null,
  -- category-conditional fields (vehicle make/model, guest count, ...)
  detail jsonb not null default '{}'::jsonb,
  budget_mode askr.budget_mode not null default 'fixed',
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  needed_by timestamptz,
  location_label text not null default '',
  lat double precision,
  lng double precision,
  radius_km integer not null default 15,
  urgency askr.urgency not null default 'standard',
  visibility askr.request_visibility not null default 'public',
  status askr.request_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint requests_fixed_budget_present
    check (budget_mode = 'open' or budget_cents is not null)
);

create index requests_buyer_idx on askr.requests (buyer_id, created_at desc);
create index requests_status_idx on askr.requests (status, published_at desc);
create index requests_category_idx on askr.requests (category_id);

create table askr.request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references askr.requests (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index request_media_request_idx on askr.request_media (request_id);

-- Who the request was broadcast to. Written once at publish; it is both the
-- notification log and the predicate a provider's read access is granted through.
create table askr.request_broadcasts (
  request_id uuid not null references askr.requests (id) on delete cascade,
  provider_id uuid not null references askr.provider_profiles (id) on delete cascade,
  distance_km numeric(6, 2),
  notified_at timestamptz not null default now(),
  primary key (request_id, provider_id)
);

create index request_broadcasts_provider_idx on askr.request_broadcasts (provider_id, notified_at desc);

-- ---------------------------------------------------------------- offers

create table askr.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references askr.requests (id) on delete cascade,
  provider_id uuid not null references askr.provider_profiles (id) on delete cascade,
  price_cents integer not null check (price_cents > 0),
  description text not null,
  eta_minutes integer check (eta_minutes is null or eta_minutes >= 0),
  warranty_months integer not null default 0 check (warranty_months >= 0),
  terms text,
  expires_at timestamptz not null,
  status askr.offer_status not null default 'active',
  created_at timestamptz not null default now()
);

-- A provider holds at most one live offer per request. Withdrawing frees the slot,
-- which is the whole negotiation mechanism in Phase 1 — there are no counter-offers.
create unique index offers_one_active_per_provider
  on askr.offers (request_id, provider_id)
  where status = 'active';

create index offers_request_idx on askr.offers (request_id, created_at desc);
create index offers_provider_idx on askr.offers (provider_id, created_at desc);

create table askr.offer_attachments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references askr.offers (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index offer_attachments_offer_idx on askr.offer_attachments (offer_id);

-- ---------------------------------------------------------------- chat

-- A thread is (request_id, provider_id): the buyer talks to each provider separately.
create table askr.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references askr.requests (id) on delete cascade,
  provider_id uuid not null references askr.provider_profiles (id) on delete cascade,
  sender_id uuid not null references askr.profiles (id) on delete cascade,
  body text not null default '',
  attachment_path text,
  mime_type text,
  created_at timestamptz not null default now(),
  constraint messages_not_empty check (body <> '' or attachment_path is not null)
);

create index messages_thread_idx on askr.messages (request_id, provider_id, created_at);

-- ---------------------------------------------------------------- escrow

create table askr.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references askr.requests (id) on delete restrict,
  offer_id uuid not null unique references askr.offers (id) on delete restrict,
  buyer_id uuid not null references askr.profiles (id) on delete restrict,
  provider_id uuid not null references askr.provider_profiles (id) on delete restrict,
  state askr.order_state not null default 'pending_payment',
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

create index orders_buyer_idx on askr.orders (buyer_id, created_at desc);
create index orders_provider_idx on askr.orders (provider_id, created_at desc);
create index orders_state_idx on askr.orders (state);

-- Append-only. The order's current state is reconciled against the latest row.
create table askr.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references askr.orders (id) on delete restrict,
  from_state askr.order_state,
  to_state askr.order_state not null,
  actor askr.order_actor not null,
  actor_id uuid references askr.profiles (id),
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on askr.order_events (order_id, id);

-- Append-only is enforced at the table, not in RLS: RLS does not apply to the
-- service role, and the ledger has to hold against every connection.
create function askr.block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'order_events is append-only (attempted %)', tg_op;
end;
$$;

create trigger order_events_no_update
  before update or delete on askr.order_events
  for each row execute function askr.block_mutation();

-- orders.state may only move through askr.apply_order_transition, which sets the
-- transaction-local flag below. Anything else editing state is a bug, including
-- service-role code, so it is refused at the table.
create function askr.guard_order_state()
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
  before update on askr.orders
  for each row execute function askr.guard_order_state();

-- The atomic tail of a transition. Whether from -> to is legal, and whether this
-- actor may make that move, is decided in src/lib/escrow/machine.ts; this function
-- re-checks the from-state under a row lock so two callers cannot both move an
-- order, and writes the state change and its ledger row in one transaction.
create function askr.apply_order_transition(
  p_order_id uuid,
  p_from_state askr.order_state,
  p_to_state askr.order_state,
  p_actor askr.order_actor,
  p_actor_id uuid,
  p_reason text,
  p_payload jsonb default '{}'::jsonb,
  p_patch jsonb default '{}'::jsonb
)
returns askr.orders
language plpgsql
security definer
set search_path = askr, extensions
as $$
declare
  v_order askr.orders;
begin
  select * into v_order from askr.orders where id = p_order_id for update;

  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  if v_order.state <> p_from_state then
    raise exception 'order % is %, expected % — transition rejected',
      p_order_id, v_order.state, p_from_state;
  end if;

  perform set_config('askr.in_transition', 'on', true);

  update askr.orders
  set state = p_to_state,
      stripe_payment_intent_id = coalesce(p_patch ->> 'stripe_payment_intent_id', stripe_payment_intent_id),
      stripe_transfer_id = coalesce(p_patch ->> 'stripe_transfer_id', stripe_transfer_id),
      stripe_account_id = coalesce(p_patch ->> 'stripe_account_id', stripe_account_id)
  where id = p_order_id
  returning * into v_order;

  perform set_config('askr.in_transition', 'off', true);

  insert into askr.order_events (order_id, from_state, to_state, actor, actor_id, reason, payload)
  values (p_order_id, p_from_state, p_to_state, p_actor, p_actor_id, p_reason, coalesce(p_payload, '{}'::jsonb));

  return v_order;
end;
$$;

-- Stripe event ids, inserted before the event is handled. The insert failing on
-- the primary key is the idempotency check.
create table askr.stripe_webhook_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table askr.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references askr.orders (id) on delete restrict,
  raised_by uuid not null references askr.profiles (id),
  reason text not null,
  status askr.dispute_status not null default 'open',
  resolution askr.dispute_resolution,
  resolution_reason text,
  resolved_by uuid references askr.profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index disputes_one_open_per_order
  on askr.disputes (order_id)
  where status = 'open';

create index disputes_status_idx on askr.disputes (status, created_at desc);

-- ---------------------------------------------------------------- reviews

create table askr.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references askr.orders (id) on delete cascade,
  request_id uuid not null references askr.requests (id) on delete cascade,
  buyer_id uuid not null references askr.profiles (id) on delete cascade,
  provider_id uuid not null references askr.provider_profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '',
  reply_body text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index reviews_provider_idx on askr.reviews (provider_id, created_at desc);

create function askr.refresh_provider_rating()
returns trigger
language plpgsql
security definer
set search_path = askr, extensions
as $$
declare
  v_provider uuid := coalesce(new.provider_id, old.provider_id);
begin
  update askr.provider_profiles p
  set rating_avg = coalesce(agg.avg_rating, 0),
      rating_count = coalesce(agg.n, 0)
  from (
    select avg(rating)::numeric(3, 2) as avg_rating, count(*) as n
    from askr.reviews
    where provider_id = v_provider
  ) agg
  where p.id = v_provider;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update of rating or delete on askr.reviews
  for each row execute function askr.refresh_provider_rating();

-- ---------------------------------------------------------------- notifications

create table askr.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references askr.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on askr.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- geo

-- Great-circle distance in km. Immutable so it can be used in indexes and policies.
create function askr.distance_km(
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

alter publication supabase_realtime add table askr.messages;
alter publication supabase_realtime add table askr.offers;
alter publication supabase_realtime add table askr.order_events;
alter publication supabase_realtime add table askr.request_broadcasts;
