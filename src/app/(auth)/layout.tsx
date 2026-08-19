import Link from "next/link";
import { Wordmark } from "@/components/ui/identity";
import { BRAND } from "@/lib/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col bg-void bg-grid-texture">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-5 py-12">
        <Link href="/" className="mb-8 inline-flex">
          <Wordmark />
        </Link>
        <p className="mb-8 font-display text-[25px] font-semibold leading-[1.2]">
          {BRAND.tagline.split(" ").slice(0, -3).join(" ")}{" "}
          <em className="not-italic text-signal">
            {BRAND.tagline.split(" ").slice(-3).join(" ")}
          </em>
        </p>
        {children}
      </div>
    </main>
  );
}
