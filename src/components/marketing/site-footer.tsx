import Link from "next/link";
import { BrandMark } from "@/components/ui/identity";
import { BRAND } from "@/lib/brand";

/**
 * The fat footer, shaped after joinza.io: a brand block with its own call to
 * action, four link columns, a locale strip, and the legal row.
 *
 * Destinations that have no page yet are rendered as text with a "Soon" tag
 * rather than as links. A footer full of links that 404 is worse than a footer
 * that admits what has not been built.
 */

type FooterLink = { label: string; href?: string; soon?: boolean };

const PRODUCT: FooterLink[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Escrow & payments", href: "/#escrow" },
  { label: "Post a request", href: "/requests/new" },
  { label: "For providers", href: "/signup?role=provider" },
];

const COMPANY: FooterLink[] = [
  { label: "About", soon: true },
  { label: "Careers", soon: true },
  { label: "Press", soon: true },
];

const SUPPORT: FooterLink[] = [
  { label: "Contact", href: "mailto:hello@servuber.co.nz" },
  { label: "Help centre", soon: true },
  { label: "Trust & safety", soon: true },
];

const LEGAL: FooterLink[] = [
  { label: "Terms", soon: true },
  { label: "Privacy", soon: true },
  { label: "Cookies", soon: true },
  { label: "Refund policy", soon: true },
];

export function SiteFooter({ categories }: { categories: { slug: string; name: string }[] }) {
  const categoryLinks: FooterLink[] = categories.map((c) => ({
    label: c.name,
    href: `/requests/new?category=${c.slug}`,
  }));

  return (
    <footer className="border-t border-grid/50 px-8 pb-10 pt-16 md:px-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5">
              <BrandMark size={26} />
              <span className="font-display text-[17px] font-bold">
                {BRAND.nameLead}
                <span className="text-signal">{BRAND.nameAccent}</span>
              </span>
            </Link>

            <p className="mt-4 font-display text-[19px] font-medium leading-snug">
              {BRAND.tagline}
            </p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
              The New Zealand marketplace where you name the price and verified pros compete for
              the job — with every payment held in escrow.
            </p>

            <Link
              href="/requests/new"
              className="liquid-glass mt-6 inline-block rounded-full px-5 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-80"
            >
              Post a request →
            </Link>
          </div>

          <Column title="Product" links={PRODUCT} />
          <Column title="Categories" links={categoryLinks} />
          <Column title="Company" links={COMPANY} />
          <Column title="Support" links={SUPPORT} />
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-grid/50 pt-7 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 font-mono text-[11.5px] text-muted">
            <span>🌐 English</span>
            <span aria-hidden className="text-faint">•</span>
            <span>$ NZD</span>
          </div>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
            {LEGAL.map((l) => (
              <li key={l.label}>
                <FooterItem link={l} />
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-7 text-[12px] text-faint">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved. {BRAND.name} operates in
          New Zealand and prices in NZD.
        </p>
      </div>
    </footer>
  );
}

/** Open on desktop, an accordion on mobile — <details> so it needs no JS. */
function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <details className="group border-b border-grid/50 pb-3 lg:border-none lg:pb-0" open>
      <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-faint lg:cursor-default lg:pointer-events-none">
        {title}
        <span aria-hidden className="text-faint transition-transform group-open:rotate-45 lg:hidden">
          +
        </span>
      </summary>

      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <FooterItem link={l} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function FooterItem({ link }: { link: FooterLink }) {
  if (link.soon || !link.href) {
    return (
      <span className="flex items-center gap-2 text-[13px] text-faint">
        {link.label}
        <span className="rounded-full border border-grid px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.05em]">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link href={link.href} className="text-[13px] text-muted transition-colors hover:text-text">
      {link.label}
    </Link>
  );
}
