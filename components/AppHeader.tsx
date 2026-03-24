"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppHeader() {
  const path = usePathname();
  const onAnalyze = path === "/";
  const onHowItWorks = path === "/how-it-works";
  const onRunHistory = path === "/run-history";
  const onTopicalMap = path === "/topical-map";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-slate-100 hover:text-white md:text-base"
        >
          Internal Linking Opportunity Finder
        </Link>
        <nav
          className="flex items-center gap-6 text-sm"
          aria-label="Primary"
        >
          <Link
            href="/"
            className={
              onAnalyze
                ? "font-medium text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }
          >
            Analyze
          </Link>
          <Link
            href="/how-it-works"
            className={
              onHowItWorks
                ? "font-medium text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }
          >
            How it works
          </Link>
          <Link
            href="/run-history"
            className={
              onRunHistory
                ? "font-medium text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }
          >
            Run history
          </Link>
          <Link
            href="/topical-map"
            className={
              onTopicalMap
                ? "font-medium text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }
          >
            Topical map
          </Link>
        </nav>
      </div>
    </header>
  );
}
