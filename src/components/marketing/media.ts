/**
 * Every video the marketing surface plays, in one place.
 *
 * These are currently hotlinked to a third-party CDN: the bandwidth is not
 * ours, the URLs can be withdrawn without notice, and the licensing is
 * unclear. Re-hosting them on Vercel Blob or a Mux account we control is a
 * pre-launch job — and because they all live here, it is one edit.
 */

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P";

export const MEDIA = {
  hero: `${CDN}/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4`,
  mission: `${CDN}/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b.mp4`,
  solution: `${CDN}/hf_20260325_125119_8e5ae31c-0021-4396-bc08-f7aebeb877a2.mp4`,
  /** HLS, so it needs hls.js everywhere except Safari. */
  ctaStream: "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8",
} as const;
