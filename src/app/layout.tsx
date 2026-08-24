import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter, IBM_Plex_Mono, Great_Vibes } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
});

const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-script" });

export const metadata: Metadata = {
  title: "DigiHost — Blacklisting Release Console",
  description:
    "End-to-end, system-driven blacklisting release for cheque and NPA cases: initiation, maker-checker review, BROPs pool, release letters, CAD/CIC validation and eligible auto-unfreeze.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plex.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
