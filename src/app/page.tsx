import { AppHome } from "@/components/home/app-home";
import { Cta } from "@/components/marketing/cta";
import { Discovery } from "@/components/marketing/discovery";
import { Hero } from "@/components/marketing/hero";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Mission } from "@/components/marketing/mission";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Solution } from "@/components/marketing/solution";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * One route, two products. A signed-in user gets mockup screen 01 — their own
 * requests and the live feed. A guest gets the marketing landing, because
 * pitching the platform to someone already using it is wasted screen.
 */
export default async function HomePage() {
  const viewer = await getViewer();

  if (viewer) return <AppHome viewer={viewer} />;

  const supabase = await createClient();

  const [{ data: categories }, { count: providerCount }, { data: sample }] = await Promise.all([
    supabase.from("categories").select("slug, name").eq("is_phase1", true).order("sort_order"),
    supabase
      .from("provider_profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "verified"),
    // The avatars are real verified businesses, not stock faces.
    supabase
      .from("provider_profiles")
      .select("business_name")
      .eq("verification_status", "verified")
      .order("rating_count", { ascending: false })
      .limit(3),
  ]);

  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <Hero
          providerCount={providerCount ?? 0}
          sampleNames={(sample ?? []).map((p) => p.business_name)}
        />
        <Discovery />
        <Mission />
        <Solution />
        <Cta />
      </main>
      <SiteFooter categories={categories ?? []} />
    </>
  );
}
