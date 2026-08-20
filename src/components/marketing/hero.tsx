"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/identity";
import { BRAND } from "@/lib/brand";
import { fadeUp } from "./motion";
import { MEDIA } from "./media";


/**
 * Full-viewport video hero. The form is a plain GET to /requests/new, so what
 * the visitor types survives the trip and lands prefilled in the real request
 * form — a guest gets bounced to sign-in first and comes back to it.
 */
export function Hero({ providerCount, sampleNames }: { providerCount: number; sampleNames: string[] }) {
  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-28 md:pt-32">
      <video
        className="absolute inset-0 size-full object-cover"
        src={MEDIA.hero}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
      />
      {/* fades the video into the page rather than cutting it off at an edge */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-void to-transparent" />

      <div className="relative z-10 flex flex-col items-center text-center">
        {providerCount > 0 && (
          <motion.div {...fadeUp(0)} className="mb-6 flex items-center gap-3">
            <div className="flex -space-x-2">
              {sampleNames.map((name) => (
                <span key={name} className="rounded-full border-2 border-void">
                  <Avatar name={name} size={32} />
                </span>
              ))}
            </div>
            <span className="text-[13px] text-muted">
              <span className="font-mono text-text">{providerCount}</span> verified pros across New
              Zealand
            </span>
          </motion.div>
        )}

        <motion.h1
          {...fadeUp(0.1)}
          className="max-w-4xl font-display text-5xl font-medium tracking-[-2px] md:text-7xl lg:text-8xl"
        >
          Name your price.
          <br />
          Pros <em className="font-serif font-normal italic">compete</em>.
        </motion.h1>

        <motion.p {...fadeUp(0.2)} className="mt-6 max-w-xl text-lg text-text/90">
          {BRAND.description}
        </motion.p>

        <motion.form
          {...fadeUp(0.3)}
          action="/requests/new"
          method="get"
          className="liquid-glass mt-9 flex w-full max-w-lg items-center gap-2 rounded-full p-2"
        >
          <label htmlFor="hero-title" className="sr-only">
            What do you need
          </label>
          <input
            id="hero-title"
            name="title"
            required
            maxLength={120}
            placeholder="4-bedroom house clean, this Saturday"
            className="min-w-0 flex-1 bg-transparent px-5 py-3 text-[14.5px] text-text placeholder:text-faint focus:outline-none"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="flex-none rounded-full bg-signal px-8 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-void"
          >
            Get offers
          </motion.button>
        </motion.form>

        <motion.p {...fadeUp(0.4)} className="mt-4 font-mono text-[11px] text-faint">
          Free to post · Offers in minutes · Payment held in escrow
        </motion.p>
      </div>
    </section>
  );
}
