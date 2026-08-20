import Link from "next/link";
import { FaInstagram, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { BrandMark } from "@/components/ui/identity";
import { BRAND } from "@/lib/brand";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#escrow", label: "Escrow" },
  { href: "#categories", label: "Categories" },
];

/*
 * Brand marks come from react-icons rather than lucide: lucide removed its
 * brand logos over trademark concerns, so Instagram/LinkedIn/X no longer exist
 * there. Point these at the real accounts when they exist.
 */
const SOCIAL = [
  { href: "https://instagram.com", label: "Instagram", Icon: FaInstagram },
  { href: "https://linkedin.com", label: "LinkedIn", Icon: FaLinkedinIn },
  { href: "https://x.com", label: "X", Icon: FaXTwitter },
];

/**
 * Fixed and fully transparent — it floats over the hero video rather than
 * sitting on a bar. The glass buttons are the only thing with a surface.
 */
export function MarketingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-8 py-4 md:px-28">
      <nav className="flex items-center gap-8">
        <Link href="/" className="flex flex-none items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-display text-[17px] font-bold">
            {BRAND.nameLead}
            <span className="text-signal">{BRAND.nameAccent}</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-3 text-[13px] lg:flex">
          {LINKS.map((l, i) => (
            <li key={l.href} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="text-faint">•</span>}
              <Link href={l.href} className="text-muted transition-colors hover:text-text">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden items-center gap-2.5 sm:flex">
            {SOCIAL.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noreferrer"
                className="liquid-glass flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:text-text"
              >
                <Icon className="size-[15px]" />
              </a>
            ))}
          </div>

          <Link
            href="/login"
            className="liquid-glass rounded-full px-5 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-80"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
