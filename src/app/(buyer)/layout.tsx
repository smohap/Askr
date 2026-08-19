import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";

/** Everything under here is buyer-only. RLS enforces it too; this is the redirect. */
export default async function BuyerLayout({ children }: LayoutProps<"/">) {
  await requireRole("buyer");

  return (
    <>
      <AppNav />
      <div className="mx-auto w-full max-w-[520px] flex-1">{children}</div>
    </>
  );
}
