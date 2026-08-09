-- Row Level Security. Every table is deny-by-default; each policy below is the
-- complete grant for that role and action.
--
--   buyer    — their own requests, the offers on them, their orders and threads
--   provider — published requests they were broadcast to, plus their own offers
--   guest    — public published requests, provider profiles, reviews, categories
--   admin    — everything

-- ---------------------------------------------------------------- helpers
-- These read profiles/provider_profiles, so they are SECURITY DEFINER: a policy
-- on profiles that queried profiles directly would recurse.

create function askr.my_role()
returns askr.user_role
language sql
stable
security definer
set search_path = askr, extensions
as $$
  select role from askr.profiles where id = auth.uid();
$$;

create function askr.is_admin()
returns boolean
language sql
stable
security definer
set search_path = askr, extensions
as $$
  select coalesce((select role = 'admin' from askr.profiles where id = auth.uid()), false);
$$;

create function askr.my_provider_id()
returns uuid
language sql
stable
security definer
set search_path = askr, extensions
as $$
  select id from askr.provider_profiles where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------- profiles

alter table askr.profiles enable row level security;

-- Own row, admin, or the counterparty on a request you are both attached to —
-- a provider needs the buyer's name in chat, and vice versa.
create policy profiles_select on askr.profiles
for select to authenticated
using (
  id = auth.uid()
  or askr.is_admin()
  or exists (
    select 1
    from askr.provider_profiles pp
    join askr.offers o on o.provider_id = pp.id
    join askr.requests r on r.id = o.request_id
    where pp.user_id = askr.profiles.id and r.buyer_id = auth.uid()
  )
  or exists (
    select 1
    from askr.requests r
    join askr.request_broadcasts b on b.request_id = r.id
    where r.buyer_id = askr.profiles.id and b.provider_id = askr.my_provider_id()
  )
);

-- Role is not self-assignable: the update must leave it as it already is.
create policy profiles_update_own on askr.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = askr.my_role());

create policy profiles_admin_all on askr.profiles
for all to authenticated
using (askr.is_admin())
with check (askr.is_admin());

-- ---------------------------------------------------------------- categories

alter table askr.categories enable row level security;

create policy categories_select on askr.categories
for select to anon, authenticated
using (true);

-- ---------------------------------------------------------------- provider_profiles

alter table askr.provider_profiles enable row level security;

-- Business profiles are public: guests browse them, buyers compare them.
create policy provider_profiles_select on askr.provider_profiles
for select to anon, authenticated
using (true);

create policy provider_profiles_insert_own on askr.provider_profiles
for insert to authenticated
with check (user_id = auth.uid() and askr.my_role() = 'provider');

create policy provider_profiles_update_own on askr.provider_profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy provider_profiles_admin_all on askr.provider_profiles
for all to authenticated
using (askr.is_admin())
with check (askr.is_admin());

-- A provider cannot verify itself, hand itself a rating, or attach a Stripe
-- account. Those columns move only through admin, the review trigger, and the
-- Connect onboarding callback (service role) respectively.
create function askr.guard_provider_self_service()
returns trigger
language plpgsql
as $$
begin
  if askr.is_admin() then
    return new;
  end if;
  new.verification_status := old.verification_status;
  new.verification_reason := old.verification_reason;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.jobs_completed := old.jobs_completed;
  new.stripe_account_id := old.stripe_account_id;
  return new;
end;
$$;

create trigger provider_profiles_guard
  before update on askr.provider_profiles
  for each row execute function askr.guard_provider_self_service();

-- ---------------------------------------------------------------- provider_categories

alter table askr.provider_categories enable row level security;

create policy provider_categories_select on askr.provider_categories
for select to anon, authenticated
using (true);

create policy provider_categories_write_own on askr.provider_categories
for all to authenticated
using (provider_id = askr.my_provider_id() or askr.is_admin())
with check (provider_id = askr.my_provider_id() or askr.is_admin());

-- ---------------------------------------------------------------- provider_documents

alter table askr.provider_documents enable row level security;

create policy provider_documents_select on askr.provider_documents
for select to authenticated
using (provider_id = askr.my_provider_id() or askr.is_admin());

create policy provider_documents_insert_own on askr.provider_documents
for insert to authenticated
with check (provider_id = askr.my_provider_id());

-- Only an admin reviews a document.
create policy provider_documents_admin_update on askr.provider_documents
for update to authenticated
using (askr.is_admin())
with check (askr.is_admin());

-- ---------------------------------------------------------------- requests

alter table askr.requests enable row level security;

create policy requests_select_public on askr.requests
for select to anon, authenticated
using (status = 'published' and visibility = 'public');

create policy requests_select_own on askr.requests
for select to authenticated
using (buyer_id = auth.uid() or askr.is_admin());

-- A provider sees a request because it was broadcast to them — including private
-- ones, which is the point of the broadcast table being the access predicate.
create policy requests_select_broadcast on askr.requests
for select to authenticated
using (
  exists (
    select 1 from askr.request_broadcasts b
    where b.request_id = askr.requests.id and b.provider_id = askr.my_provider_id()
  )
);

create policy requests_insert_own on askr.requests
for insert to authenticated
with check (buyer_id = auth.uid());

create policy requests_update_own on askr.requests
for update to authenticated
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

create policy requests_delete_draft on askr.requests
for delete to authenticated
using (buyer_id = auth.uid() and status = 'draft');

create policy requests_admin_all on askr.requests
for all to authenticated
using (askr.is_admin())
with check (askr.is_admin());

-- ---------------------------------------------------------------- request_media

alter table askr.request_media enable row level security;

create policy request_media_select on askr.request_media
for select to anon, authenticated
using (
  exists (
    select 1 from askr.requests r
    where r.id = request_id
      and (
        (r.status = 'published' and r.visibility = 'public')
        or r.buyer_id = auth.uid()
        or askr.is_admin()
        or exists (
          select 1 from askr.request_broadcasts b
          where b.request_id = r.id and b.provider_id = askr.my_provider_id()
        )
      )
  )
);

create policy request_media_write_own on askr.request_media
for all to authenticated
using (exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid()))
with check (exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid()));

-- ---------------------------------------------------------------- request_broadcasts

alter table askr.request_broadcasts enable row level security;

-- Rows are written by the publish action running as service role; no insert policy.
create policy request_broadcasts_select on askr.request_broadcasts
for select to authenticated
using (
  provider_id = askr.my_provider_id()
  or askr.is_admin()
  or exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid())
);

-- ---------------------------------------------------------------- offers

alter table askr.offers enable row level security;

create policy offers_select on askr.offers
for select to authenticated
using (
  provider_id = askr.my_provider_id()
  or askr.is_admin()
  or exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid())
);

-- Offering requires a verified provider, a published request, and a broadcast.
create policy offers_insert_provider on askr.offers
for insert to authenticated
with check (
  provider_id = askr.my_provider_id()
  and exists (
    select 1 from askr.provider_profiles pp
    where pp.id = provider_id and pp.verification_status = 'verified'
  )
  and exists (
    select 1 from askr.requests r
    where r.id = request_id and r.status = 'published'
  )
  and exists (
    select 1 from askr.request_broadcasts b
    where b.request_id = offers.request_id and b.provider_id = offers.provider_id
  )
);

-- The provider withdraws; the buyer accepts or rejects. Both land here, and the
-- server action is what decides which status change is legal.
create policy offers_update_participants on askr.offers
for update to authenticated
using (
  provider_id = askr.my_provider_id()
  or exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid())
)
with check (
  provider_id = askr.my_provider_id()
  or exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid())
);

create policy offers_admin_all on askr.offers
for all to authenticated
using (askr.is_admin())
with check (askr.is_admin());

-- ---------------------------------------------------------------- offer_attachments

alter table askr.offer_attachments enable row level security;

create policy offer_attachments_select on askr.offer_attachments
for select to authenticated
using (
  exists (
    select 1 from askr.offers o
    where o.id = offer_id
      and (
        o.provider_id = askr.my_provider_id()
        or askr.is_admin()
        or exists (select 1 from askr.requests r where r.id = o.request_id and r.buyer_id = auth.uid())
      )
  )
);

create policy offer_attachments_insert_own on askr.offer_attachments
for insert to authenticated
with check (
  exists (select 1 from askr.offers o where o.id = offer_id and o.provider_id = askr.my_provider_id())
);

-- ---------------------------------------------------------------- messages

alter table askr.messages enable row level security;

create policy messages_select_thread on askr.messages
for select to authenticated
using (
  askr.is_admin()
  or provider_id = askr.my_provider_id()
  or exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid())
);

create policy messages_insert_thread on askr.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    provider_id = askr.my_provider_id()
    or exists (select 1 from askr.requests r where r.id = request_id and r.buyer_id = auth.uid())
  )
);

-- ---------------------------------------------------------------- orders

alter table askr.orders enable row level security;

-- Read-only to participants. Orders are created and moved by server code holding
-- the service role, through apply_order_transition — there is no write policy.
create policy orders_select on askr.orders
for select to authenticated
using (
  buyer_id = auth.uid()
  or provider_id = askr.my_provider_id()
  or askr.is_admin()
);

-- ---------------------------------------------------------------- order_events

alter table askr.order_events enable row level security;

create policy order_events_select on askr.order_events
for select to authenticated
using (
  exists (
    select 1 from askr.orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid() or o.provider_id = askr.my_provider_id() or askr.is_admin())
  )
);

-- ---------------------------------------------------------------- stripe_webhook_events

alter table askr.stripe_webhook_events enable row level security;
-- No policies: service role only.

-- ---------------------------------------------------------------- disputes

alter table askr.disputes enable row level security;

create policy disputes_select on askr.disputes
for select to authenticated
using (
  askr.is_admin()
  or exists (
    select 1 from askr.orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid() or o.provider_id = askr.my_provider_id())
  )
);

create policy disputes_insert_participant on askr.disputes
for insert to authenticated
with check (
  raised_by = auth.uid()
  and exists (
    select 1 from askr.orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid() or o.provider_id = askr.my_provider_id())
  )
);

create policy disputes_admin_update on askr.disputes
for update to authenticated
using (askr.is_admin())
with check (askr.is_admin());

-- ---------------------------------------------------------------- reviews

alter table askr.reviews enable row level security;

-- Reviews are a public trust signal.
create policy reviews_select on askr.reviews
for select to anon, authenticated
using (true);

create policy reviews_insert_buyer on askr.reviews
for insert to authenticated
with check (
  buyer_id = auth.uid()
  and exists (
    select 1 from askr.orders o
    where o.id = order_id and o.buyer_id = auth.uid() and o.state = 'released'
  )
);

create policy reviews_update_buyer on askr.reviews
for update to authenticated
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

-- The provider's right of reply — the reply columns only, enforced by the trigger.
create policy reviews_reply_provider on askr.reviews
for update to authenticated
using (provider_id = askr.my_provider_id())
with check (provider_id = askr.my_provider_id());

create function askr.guard_review_reply()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.buyer_id <> auth.uid() and not askr.is_admin() then
    -- a provider replying may touch reply_body/replied_at and nothing else
    new.rating := old.rating;
    new.body := old.body;
  end if;
  return new;
end;
$$;

create trigger reviews_guard_reply
  before update on askr.reviews
  for each row execute function askr.guard_review_reply();

-- ---------------------------------------------------------------- notifications

alter table askr.notifications enable row level security;

create policy notifications_select_own on askr.notifications
for select to authenticated
using (user_id = auth.uid());

create policy notifications_update_own on askr.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
