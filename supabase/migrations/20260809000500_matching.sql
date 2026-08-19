-- Provider matching for broadcast.
--
-- A provider matches a request when all three hold:
--   1. they are verified — an unverified provider never receives work
--   2. they list the request's category
--   3. the distance between them satisfies BOTH radii: the provider is willing
--      to travel that far, and the buyer is willing to look that far
--
-- The two-sided radius is deliberate. Using only the provider's radius would
-- push a distant provider onto a buyer who asked for someone local; using only
-- the buyer's would notify providers who do not serve the area.

create function askr.match_providers(p_request_id uuid)
returns table (provider_id uuid, distance_km numeric)
language sql
stable
security definer
set search_path = askr, extensions
as $$
  select
    p.id,
    round(askr.distance_km(r.lat, r.lng, p.lat, p.lng)::numeric, 2)
  from askr.requests r
  join askr.provider_categories pc on pc.category_id = r.category_id
  join askr.provider_profiles p on p.id = pc.provider_id
  where r.id = p_request_id
    and p.verification_status = 'verified'
    and p.lat is not null
    and p.lng is not null
    and r.lat is not null
    and r.lng is not null
    and askr.distance_km(r.lat, r.lng, p.lat, p.lng)
        <= least(p.service_radius_km, r.radius_km)
  order by 2;
$$;

-- Broadcast is a service-role operation, so no client role gets to call this.
revoke execute on function askr.match_providers(uuid) from anon, authenticated;

-- Expiring offers. An offer past its expiry stops counting as live; this is
-- called on read rather than scheduled, so there is no cron dependency.
create function askr.expire_stale_offers()
returns void
language sql
volatile
security definer
set search_path = askr, extensions
as $$
  update askr.offers
  set status = 'expired'
  where status = 'active' and expires_at < now();
$$;
