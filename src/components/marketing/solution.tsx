"use client";

import { motion } from "framer-motion";
import { fadeUp } from "./motion";

const SOLUTION_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_125119_8e5ae31c-0021-4396-bc08-f7aebeb877a2.mp4";

const FEATURES = [
  {
    title: "Open offers",
    copy: "Post once and every matched pro nearby sees it. Compare price, ETA, distance and rating side by side.",
  },
  {
    title: "Escrow payment",
    copy: "Your money is held from the moment you accept and released only when you confirm the job is done.",
  },
  {
    title: "Verified pros",
    copy: "ID, insurance and trade licences are checked before anyone can quote on your job.",
  },
  {
    title: "Real reviews",
    copy: "Only a buyer who paid for a completed job can leave one, and the pro gets a right of reply.",
  },
];

export function Solution() {
  return (
    <section className="border-t border-grid/50 px-6 py-32 md:py-44">
      <div className="mx-auto max-w-6xl">
        <motion.p
          {...fadeUp(0)}
          className="font-mono text-xs uppercase tracking-[3px] text-muted"
        >
          Solution
        </motion.p>

        <motion.h2
          {...fadeUp(0.1)}
          className="mt-5 max-w-3xl font-display text-4xl font-medium tracking-[-1px] md:text-6xl"
        >
          The platform for{" "}
          <em className="font-serif font-normal italic">honest</em> pricing
        </motion.h2>

        <motion.video
          {...fadeUp(0.2)}
          className="mt-14 aspect-[3/1] w-full rounded-2xl object-cover"
          src={SOLUTION_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
        />

        <div className="mt-16 grid gap-8 md:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...fadeUp(0.3 + i * 0.08)}>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.copy}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
