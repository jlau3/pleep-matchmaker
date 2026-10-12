import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { Nav } from "@/components/Nav";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={rounded.variable}>
      <body className="min-h-dvh antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4">{children}</main>
      </body>
    </html>
  );
}
