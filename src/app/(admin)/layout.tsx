import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/verification", label: "Verification" },
  { href: "/admin/disputes", label: "Disputes" },
];

/**
 * The admin console. Desktop-first like the provider side, same tokens.
 * Admin is not self-assignable — see the seed, which promotes the one account.
 */
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  await requireRole("admin");

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
