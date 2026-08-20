import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter, Space_Grotesk } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Weights are the ones the mockup loads, no more.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/*
 * Marketing surface only, and only ever in italic: the accent word in a hero
 * or section heading. It never appears inside the app itself, where headings
 * are Space Grotesk.
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

// Every number, status, id, price, distance, ETA and countdown renders in this.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${instrumentSerif.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-void text-text">{children}</body>
    </html>
  );
}
