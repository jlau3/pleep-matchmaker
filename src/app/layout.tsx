import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { AddedYouBanner } from "@/components/AddedYouBanner";
import { Nav } from "@/components/Nav";
import { SupportFooter } from "@/components/SupportFooter";
import { VotesChangedRefresh } from "@/components/VotesChangedRefresh";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pleep Matchmaker",
  description: "Find Pokémon Sleep friends who want the same candy you do.",
};

const rounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-rounded",
  // The font is split into ~100 unicode-range files per weight; preloading would
  // fetch all of them. Without preload the browser loads only the slices it uses.
  preload: false,
});

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A theme picked in Settings; "system" adds no class, so CSS follows the device.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" className={theme === "system" ? rounded.variable : `${rounded.variable} ${theme}`}>
      <body className="min-h-dvh antialiased">
        <Nav />
        <AddedYouBanner />
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-4">{children}</main>
        <SupportFooter />
        <VotesChangedRefresh />
      </body>
    </html>
  );
}
