"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { MEDIA } from "./media";


/**
 * Scroll-driven word reveal. Each word owns a slice of the scroll range and
 * lifts from resting to full opacity as the reader arrives at it, so the
 * paragraph reads at the speed the page is scrolled.
 *
 * The emphasised words stay bright the whole way; everything else resolves to
 * muted. The signal accent is deliberately absent — it belongs to live state
 * and the primary action, not to headline decoration.
 */

const PARAGRAPH_ONE =
  "We're building a marketplace where price meets trust — where buyers name their budget, pros compete in the open, and every job is backed by escrow.";

const PARAGRAPH_TWO =
  "A platform where work, payment and reputation move together — with less haggling, less risk, and more certainty for everyone involved.";

const EMPHASIS = new Set(["price", "meets", "trust"]);

function Word({
  word,
  progress,
  range,
  bright,
}: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
  bright: boolean;
}) {
  const opacity = useTransform(progress, range, [0.15, 1]);

  return (
    <motion.span style={{ opacity }} className={bright ? "text-text" : "text-muted"}>
      {word}{" "}
    </motion.span>
  );
}

function RevealParagraph({
  text,
  progress,
  start,
  end,
  className,
}: {
  text: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  className: string;
}) {
  const words = text.split(" ");
  const step = (end - start) / words.length;

  return (
    <p className={className}>
      {words.map((word, i) => (
        <Word
          key={`${word}-${i}`}
          word={word}
          progress={progress}
          range={[start + i * step, start + (i + 1) * step]}
          bright={EMPHASIS.has(word.replace(/[^a-z]/gi, "").toLowerCase())}
        />
      ))}
    </p>
  );
}

export function Mission() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.55"],
  });

  return (
    <section id="escrow" className="px-6 pb-32 pt-0 md:pb-44">
      <div className="mx-auto max-w-4xl">
        <video
          className="mx-auto mb-16 w-full max-w-[560px] rounded-3xl"
          src={MEDIA.mission}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
        />

        <div ref={ref}>
          <RevealParagraph
            text={PARAGRAPH_ONE}
            progress={scrollYProgress}
            start={0}
            end={0.6}
            className="font-display text-2xl font-medium tracking-[-1px] md:text-4xl lg:text-5xl"
          />
          <RevealParagraph
            text={PARAGRAPH_TWO}
            progress={scrollYProgress}
            start={0.6}
            end={1}
            className="mt-10 font-display text-xl font-medium md:text-2xl lg:text-3xl"
          />
        </div>
      </div>
    </section>
  );
}
