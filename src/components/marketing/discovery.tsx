"use client";

import { motion } from "framer-motion";
import { MessagesSquare, Search, Users } from "lucide-react";
import { fadeUp } from "./motion";

/**
 * The problem section, aimed at providers: the places people currently go to
 * find a tradesperson, and why none of them let you compete on price.
 */
const CHANNELS = [
  {
    Icon: Search,
    name: "Search & directories",
    copy: "Ten tabs, five quote forms, and a week of waiting for callbacks that never come.",
  },
  {
    Icon: Users,
    name: "Community groups",
    copy: "A dozen recommendations, no prices, no verification, and no way to compare them.",
  },
  {
    Icon: MessagesSquare,
    name: "Word of mouth",
    copy: "Trustworthy, and completely unavailable the one weekend you actually need someone.",
  },
];

export function Discovery() {
  return (
    <section id="how-it-works" className="px-6 pb-6 pt-52 md:pb-9 md:pt-64">
      <div className="mx-auto max-w-5xl text-center">
        <motion.h2
          {...fadeUp(0)}
          className="font-display text-5xl font-medium tracking-[-2px] md:text-7xl lg:text-8xl"
        >
          Finding a pro has{" "}
          <em className="font-serif font-normal italic">changed</em>.
        </motion.h2>

        <motion.p {...fadeUp(0.1)} className="mx-auto mb-24 mt-6 max-w-2xl text-lg text-muted">
          Buyers stopped ringing around and started broadcasting. The job goes to whoever answers
          first with a fair price — not to whoever bought the biggest ad.
        </motion.p>

        <div className="mb-20 grid gap-12 md:grid-cols-3 md:gap-8">
          {CHANNELS.map(({ Icon, name, copy }, i) => (
            <motion.div key={name} {...fadeUp(0.15 + i * 0.1)} className="flex flex-col items-center">
              <div className="liquid-glass mb-7 flex size-[132px] items-center justify-center rounded-3xl">
                <Icon className="size-11 text-muted" strokeWidth={1} />
              </div>
              <h3 className="text-base font-semibold">{name}</h3>
              <p className="mt-2 max-w-xs text-sm text-muted">{copy}</p>
            </motion.div>
          ))}
        </div>

        <motion.p {...fadeUp(0.45)} className="text-center text-sm text-muted">
          If you&rsquo;re not quoting, someone else is.
        </motion.p>
      </div>
    </section>
  );
}
