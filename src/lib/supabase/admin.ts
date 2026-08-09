import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is confined to the three places that
 * genuinely act outside any one user's authority:
 *
 *   - publishing a request, which writes request_broadcasts rows for providers
 *     the buyer has no read access to
 *   - the escrow transition, which calls apply_order_transition
 *   - the Stripe webhook, which has no user session at all
 *
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
