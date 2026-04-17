import type { Metadata } from "next";
import { Sora, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";
import { MainNav } from "@/components/nav/main-nav";

const fontSans = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap"
});

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Vantage | Mock Interview Preparation Agent",
  description:
    "Adaptive mock interviews with layered memory, rubric-based coaching, and mentor review.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body className={`${fontSans.className} noise-overlay`}>
        <div className="relative min-h-screen overflow-x-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_top,rgba(142,209,255,0.15),transparent_58%)]" />
          <div className="pointer-events-none absolute left-[-12%] top-28 -z-10 h-72 w-72 rounded-full bg-sky-300/10 blur-3xl" />
          <div className="pointer-events-none absolute right-[-8%] top-40 -z-10 h-80 w-80 rounded-full bg-orange-300/10 blur-3xl" />
          <MainNav />
          {children}
        </div>
      </body>
    </html>
  );
}
