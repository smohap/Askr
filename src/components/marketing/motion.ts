import type { MotionProps } from "framer-motion";

/**
 * The one entrance every marketing section uses: up twenty pixels, fading in,
 * once. Sections stagger their children by passing increasing delays rather
 * than each inventing its own timing, so the whole page reads as one rhythm.
 *
 * `margin: "-100px"` fires the animation slightly before the element reaches
 * the viewport, so it has finished by the time it is properly in view.
 */
export const fadeUp = (delay = 0): MotionProps => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, delay, ease: "easeOut" },
});
