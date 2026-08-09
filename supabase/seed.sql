-- Askr seed. Development only — every account here shares one password.
-- Password for all seeded accounts: askr-dev-password

-- ---------------------------------------------------------------- categories
-- All eighteen PRD categories exist as rows. Six are Phase 1 and route; the rest
-- are seeded so the taxonomy is complete and nothing has to be backfilled later.

insert into public.categories (slug, name, is_phase1, sort_order) values
  ('home-services',         'Home Services',         true,  10),
  ('automotive',            'Automotive',            true,  20),
  ('electronics',           'Electronics',           true,  30),
  ('education',             'Education',             true,  40),
  ('events',                'Events',                true,  50),
  ('other',                 'Other',                 true,  60),
  ('professional-services', 'Professional Services', false, 70),
  ('health-beauty',         'Health & Beauty',       false, 80),
  ('real-estate',           'Real Estate',           false, 90),
  ('furniture',             'Furniture',             false, 100),
  ('fashion',               'Fashion',               false, 110),
  ('food',                  'Food',                  false, 120),
  ('groceries',             'Groceries',             false, 130),
  ('travel',                'Travel',                false, 140),
  ('rentals',               'Rentals',               false, 150),
  ('construction',          'Construction',          false, 160),
  ('freelance',             'Freelance',             false, 170),
  ('pets',                  'Pets',                  false, 180)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- accounts

-- handle_new_user() fires on these inserts and creates the matching profile row.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'buyer@askr.test',
   crypt('askr-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"buyer","full_name":"Ana Whitfield"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'admin@askr.test',
   crypt('askr-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"buyer","full_name":"Askr Admin"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'sparkle@askr.test',
   crypt('askr-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"provider","full_name":"Sione Cooper"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444',
   'authenticated', 'authenticated', 'maidbright@askr.test',
   crypt('askr-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"provider","full_name":"Mira Baxter"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555',
   'authenticated', 'authenticated', 'bestclean@askr.test',
   crypt('askr-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"provider","full_name":"Bevan Chand"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666',
   'authenticated', 'authenticated', 'freshstart@askr.test',
   crypt('askr-dev-password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"provider","full_name":"Fiona Reid"}', now(), now())
on conflict (id) do nothing;

-- Email identities, so password sign-in resolves.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@askr.test'
on conflict do nothing;

-- 'admin' is deliberately not settable from signup metadata, so it is set here.
update public.profiles set role = 'admin' where id = '22222222-2222-4222-8222-222222222222';

-- ---------------------------------------------------------------- providers
-- Coordinates are around Mount Eden, Auckland — the mockup's example location.

insert into public.provider_profiles (
  id, user_id, business_name, tagline, about, location_label, lat, lng,
  service_radius_km, verification_status, rating_avg, rating_count, jobs_completed
)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
   'Sparkle Clean Co.', 'Eco products, same-day availability',
   'Family-run cleaning crew covering central Auckland since 2016. Eco-certified products, fully insured.',
   'Mount Eden, Auckland', -36.8779, 174.7580, 12, 'verified', 4.90, 214, 214),

  ('aaaaaaaa-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444',
   'MaidBright', 'Reliable residential cleaning',
   'Two-person teams, weekday and weekend slots, bond-clean specialists.',
   'Kingsland, Auckland', -36.8740, 174.7460, 15, 'verified', 4.80, 96, 96),

  ('aaaaaaaa-0000-4000-8000-000000000003', '55555555-5555-4555-8555-555555555555',
   'Best Clean NZ', 'Carpet and upholstery included',
   'Commercial-grade equipment, carpet extraction included on most jobs.',
   'Epsom, Auckland', -36.8890, 174.7760, 20, 'verified', 5.00, 340, 340),

  -- Unverified on purpose: this is the row the admin verification queue opens on.
  ('aaaaaaaa-0000-4000-8000-000000000004', '66666666-6666-4666-8666-666666666666',
   'Fresh Start Services', 'New to Askr',
   'Recently registered. Awaiting document verification.',
   'Grey Lynn, Auckland', -36.8600, 174.7400, 10, 'pending', 0, 0, 0)
on conflict (id) do nothing;

-- Cleaning providers cover Home Services; Best Clean also takes Automotive
-- (interior valets), which gives the matcher a two-category provider to sort out.
insert into public.provider_categories (provider_id, category_id)
select p.id, c.id
from public.provider_profiles p
join public.categories c on c.slug = 'home-services'
where p.id in (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000003',
  'aaaaaaaa-0000-4000-8000-000000000004'
)
on conflict do nothing;

insert into public.provider_categories (provider_id, category_id)
select p.id, c.id
from public.provider_profiles p
join public.categories c on c.slug = 'automotive'
where p.id = 'aaaaaaaa-0000-4000-8000-000000000003'
on conflict do nothing;

-- A pending document for the admin queue to act on.
insert into public.provider_documents (provider_id, doc_type, storage_path, status)
values
  ('aaaaaaaa-0000-4000-8000-000000000004', 'identity',
   'aaaaaaaa-0000-4000-8000-000000000004/identity-sample.pdf', 'pending'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'insurance',
   'aaaaaaaa-0000-4000-8000-000000000004/insurance-sample.pdf', 'pending')
on conflict do nothing;
