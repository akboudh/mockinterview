import type { Metadata } from "next";

import "@/app/globals.css";
import { MainNav } from "@/components/nav/main-nav";

export const metadata: Metadata = {
  title: "Vantage | Mock Interview Preparation Agent",
  description:
    "Premium MVP for adaptive mock interviews, layered memory, rubric-based coaching, and mentor review.",
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
    <html lang="en">
      <body className="noise-overlay">
        <div className="relative min-h-screen overflow-x-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_top,rgba(142,209,255,0.13),transparent_60%)]" />
          <MainNav />
          {children}
        </div>
      </body>
    </html>
  );
}
