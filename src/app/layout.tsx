import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pleep Matchmaker",
  description: "Find Pokémon Sleep friends who want the same candy you do.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4">{children}</main>
      </body>
    </html>
  );
}
