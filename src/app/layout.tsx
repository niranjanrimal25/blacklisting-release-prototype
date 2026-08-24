import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Use system fonts to avoid Google Fonts network dependency at build time
// Variables are kept for compatibility with existing Tailwind theme

export const metadata: Metadata = {
  title: "DigiHost — Blacklisting Release Console",
  description:
    "End-to-end, system-driven blacklisting release for cheque and NPA cases: initiation, maker-checker review, BROPs pool, release letters, CAD/CIC validation and eligible auto-unfreeze.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
