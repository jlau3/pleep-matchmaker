import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { RequestsBanner } from "@/components/RequestsBanner";
import { Nav } from "@/components/Nav";
import { SupportFooter } from "@/components/SupportFooter";
import { VotesChangedRefresh } from "@/components/VotesChangedRefresh";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const DESCRIPTION =
  "Vote on the Pokémon Sleep candies you want, see your friends' candy tier list, and find new friends who want the same candy.";

/**
 * Also drives link previews (Discord, iMessage, X...): title, description, the
 * public/og.png card and, via themeColor below, the colored bar on Discord embeds.
 */
export const metadata: Metadata = {
  // Absolute base for og:image. Vercel sets the production domain; locally it's dev.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  title: "Pleep Matchmaker",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Pleep Matchmaker",
    title: "Pleep Matchmaker: candy wishlists for Pokémon Sleep friends",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Pleep Matchmaker" }],
  },
  twitter: { card: "summary_large_image" },
};

const rounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-rounded",
  // The font is split into ~100 unicode-range files per weight; preloading would
  // fetch all of them. Without preload the browser loads only the slices it uses.
  preload: false,
});

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffd24d" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A theme picked in Settings; "system" adds no class, so CSS follows the device.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" className={theme === "system" ? rounded.variable : `${rounded.variable} ${theme}`}>
      <body className="min-h-dvh antialiased">
        <Nav />
        <RequestsBanner />
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-4">{children}</main>
        <SupportFooter />
        <VotesChangedRefresh />
      </body>
    </html>
  );
}
