-- Explicit grants over everything the previous migrations created.
--
-- The ALTER DEFAULT PRIVILEGES in 20260809000050 only applies to objects created
-- by the same role that ran it. Re-granting here means the schema is usable even
-- if migrations were applied by a different role (db push vs the SQL editor).
--
-- These are table-level grants only. RLS is what actually decides who sees which
-- rows — a grant with no matching policy still returns nothing.

grant all on all tables in schema askr to anon, authenticated, service_role;
grant all on all sequences in schema askr to anon, authenticated, service_role;
grant execute on all functions in schema askr to anon, authenticated, service_role;

-- The storage policies in 20260809000300 call these, and storage runs as the
-- calling user, so the grant has to be explicit.
grant execute on function askr.is_admin() to anon, authenticated;
grant execute on function askr.my_provider_id() to anon, authenticated;
grant execute on function askr.my_role() to anon, authenticated;

-- apply_order_transition is service-role only: it is the single writer of
-- orders.state, and no client session should be able to call it.
revoke execute on function askr.apply_order_transition(
  uuid, askr.order_state, askr.order_state, askr.order_actor, uuid, text, jsonb, jsonb
) from anon, authenticated;
