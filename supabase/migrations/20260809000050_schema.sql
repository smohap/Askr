-- Askr lives in its own schema, not public.
--
-- Two consequences that are easy to miss:
--
--   1. Supabase grants anon/authenticated access to `public` out of the box. A
--      custom schema gets nothing, so usage and default privileges are set here
--      and explicit grants are re-applied in the final migration.
--   2. PostgREST only serves schemas it has been told about. Add `askr` to
--      Project Settings > API > Exposed schemas, or every query returns
--      "The schema must be one of the following". The supabase-js clients in
--      src/lib/supabase/ pass { db: { schema: 'askr' } } to match.

create schema if not exists askr;

grant usage on schema askr to anon, authenticated, service_role;

alter default privileges in schema askr
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema askr
  grant all on functions to anon, authenticated, service_role;

alter default privileges in schema askr
  grant all on sequences to anon, authenticated, service_role;
