import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";

const TABS = [
  { href: "/provider", label: "Dashboard" },
  { href: "/provider/feed", label: "Requests" },
  { href: "/provider/offers", label: "Offers" },
  { href: "/provider/jobs", label: "Jobs" },
  { href: "/provider/payouts", label: "Payouts" },
  { href: "/provider/reviews", label: "Reviews" },
  { href: "/provider/profile", label: "Profile" },
];

/**
 * The provider side is desktop-first, per the design brief — same tokens, same
 * type scale and border treatment as the buyer flow, wider layout.
 */
export default async function ProviderLayout({ children }: LayoutProps<"/">) {
  await requireRole("provider");

  return (
    <>
      <AppNav />
      <div className="mx-auto w-full max-w-[1080px] flex-1 px-5">
        <nav className="flex gap-1 border-b border-grid">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="-mb-px border-b-2 border-transparent px-3.5 py-3 text-[13px] text-muted transition-colors hover:border-signal-dim hover:text-text"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </>
  );
}
