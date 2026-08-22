"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_MAILTO } from "@/lib/support";
import { PRODUCT_NAME } from "@/lib/brand";

const navLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#workflow", label: "Workflow" },
  { href: "#teams", label: "Teams" },
  { href: "#synentrix", label: "Synentrix" },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-3 sm:px-4 pt-3 sm:pt-4">
      <header className="w-full max-w-4xl rounded-full border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-lg shadow-slate-900/5">
        <div className="px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm tracking-tight truncate">{PRODUCT_NAME}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-700 rounded-full hover:bg-indigo-50 transition-colors whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <a href={SUPPORT_MAILTO}>
              <Button size="sm" className="text-xs sm:text-sm px-3 sm:px-4">Contact us</Button>
            </a>
            <button
              type="button"
              className="md:hidden p-1.5 rounded-full hover:bg-slate-100 shrink-0"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-4 w-4 text-slate-600" /> : <Menu className="h-4 w-4 text-slate-600" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-slate-100 px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block px-3 py-2 text-sm text-slate-600 hover:text-indigo-700 rounded-lg hover:bg-indigo-50"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 flex gap-2 sm:hidden border-t border-slate-100 mt-2">
              <Link href="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">Log in</Button>
              </Link>
            </div>
          </nav>
        )}
      </header>
    </div>
  );
}
