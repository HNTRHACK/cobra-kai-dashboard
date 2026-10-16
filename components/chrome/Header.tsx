"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { pad2 } from "@/lib/format";
import { NAV } from "@/lib/nav";


function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("ck-theme", next);
        } catch {}
        setTheme(next);
      }}
      aria-label={theme ? `Switch to ${next} theme` : "Toggle theme"}
      className="grid size-10 place-items-center rounded-full border border-current/25 transition-colors duration-300 hover:bg-current/10"
    >
      {theme === "light" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
    </button>
  );
}

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* mix-blend-difference header, as on the UMANG site: legible over ink and ivory surfaces */}
      <header className="fixed inset-x-0 top-0 z-50 text-ivory mix-blend-difference">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="group flex items-baseline gap-2" aria-label="COBRA KAI — overview">
            <span className="display text-2xl tracking-tight">COBRA KAI</span>
            <span className="serif-i hidden text-lg text-ivory/70 sm:inline">quant</span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
            {NAV.map((n, i) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className="link-line group py-2 text-sm font-medium text-ivory/75 transition-colors hover:text-ivory aria-[current=page]:text-ivory"
              >
                <span className="num mr-1.5 text-[11px] text-ivory/50">{pad2(i + 1)}</span>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-current/25 lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-0 z-[60] flex flex-col bg-ink px-4 pt-6 pb-10 text-ivory sm:px-6"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
            exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex h-14 items-center justify-between">
              <span className="display text-2xl">COBRA KAI</span>
              <button
                type="button"
                autoFocus
                className="grid size-10 place-items-center rounded-full border border-ivory/25"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <nav className="mt-12 flex flex-col" aria-label="Mobile">
              {NAV.map((n, i) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className="flex items-baseline gap-4 border-b border-ivory/15 py-5 aria-[current=page]:text-marigold"
                >
                  <span className="num text-sm text-ivory/50">{pad2(i + 1)}</span>
                  <span className="display text-5xl">{n.label}</span>
                </Link>
              ))}
            </nav>
            <p className="serif-i mt-auto text-2xl text-ivory/60">Built for volatility.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
