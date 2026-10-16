import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter_Tight } from "next/font/google";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import "./globals.css";

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "COBRA KAI — Quantitative Trading Intelligence", template: "%s · COBRA KAI" },
  description: "Built for volatility. Driven by intelligence. Market analysis, leakage-safe ML, flash-crash regimes, risk management and competition results for GLACIER_GAS.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
    { media: "(prefers-color-scheme: light)", color: "#f3eee4" },
  ],
};

// Resolve theme before paint: saved choice → OS preference → dark (UMANG default surface).
const themeScript = `(function(){try{var t=localStorage.getItem('ck-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${interTight.variable} ${instrumentSerif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only z-[70] rounded-full bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
