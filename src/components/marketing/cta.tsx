"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/ui/identity";
import { fadeUp } from "./motion";

const CTA_STREAM = "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";

/**
 * HLS background. Safari plays .m3u8 natively; everywhere else needs hls.js,
 * which is imported dynamically so the ~150KB parser is not in the bundle for
 * anyone who never scrolls this far.
 */
export function Cta() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = CTA_STREAM;
      return;
    }

    let hls: { destroy: () => void } | null = null;

    void import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return;
      const instance = new Hls();
      instance.loadSource(CTA_STREAM);
      instance.attachMedia(video);
      hls = instance;
    });

    return () => hls?.destroy();
  }, []);

  return (
    <section className="relative overflow-hidden border-t border-grid/50 px-6 py-32 md:py-44">
      <video
        ref={videoRef}
        className="absolute inset-0 z-0 size-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
      />
      <div className="absolute inset-0 z-[1] bg-void/70" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div {...fadeUp(0)}>
          <BrandMark size={40} />
        </motion.div>

        <motion.h2
          {...fadeUp(0.1)}
          className="mt-8 font-display text-4xl font-medium tracking-[-1px] md:text-6xl"
        >
          Start your <em className="font-serif font-normal italic">first job</em>
        </motion.h2>

        <motion.p {...fadeUp(0.2)} className="mt-5 max-w-lg text-muted">
          Post what you need and set your price. Verified pros nearby will answer within minutes —
          and nothing leaves your account until the work is done.
        </motion.p>

        <motion.div {...fadeUp(0.3)} className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/requests/new"
            className="rounded-lg bg-signal px-8 py-3.5 text-[14px] font-bold text-void transition-opacity hover:opacity-90"
          >
            Post a request
          </Link>
          <Link
            href="/signup?role=provider"
            className="liquid-glass rounded-lg px-8 py-3.5 text-[14px] font-semibold transition-opacity hover:opacity-80"
          >
            Become a pro
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
