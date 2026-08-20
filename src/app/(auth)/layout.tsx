import Link from "next/link";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MEDIA } from "@/components/marketing/media";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BrandMark } from "@/components/ui/identity";
import { BRAND } from "@/lib/brand";

/**
 * The bridge between the landing page and the app, so it wears the landing
 * page's clothes: the same hero video, heavily dimmed, with the form floating
 * on glass over it.
 *
 * The video is the one thing here that is decoration, so it carries the
 * overlay: at 82% void the type stays comfortably above contrast minimums
 * whatever frame happens to be playing behind it.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const words = BRAND.tagline.split(" ");

  return (
    <div className="relative flex min-h-dvh flex-col">
      <video
        className="fixed inset-0 -z-10 size-full object-cover"
        src={MEDIA.hero}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
      />
      <div className="fixed inset-0 -z-10 bg-void/[0.82]" />

      <MarketingNav showSignIn={false} />

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 pb-16 pt-28">
        <Link href="/" className="mb-7 inline-flex items-center gap-2.5">
          <BrandMark size={26} />
          <span className="font-display text-[17px] font-bold">
            {BRAND.nameLead}
            <span className="text-signal">{BRAND.nameAccent}</span>
          </span>
        </Link>

        <h1 className="mb-8 font-display text-[28px] font-medium leading-[1.15] tracking-[-1px]">
          {words.slice(0, -3).join(" ")}{" "}
          <em className="font-serif font-normal italic">{words.slice(-3).join(" ")}</em>
        </h1>

        <div className="liquid-glass rounded-2xl p-6">{children}</div>
      </main>

      <SiteFooter variant="slim" />
    </div>
  );
}
