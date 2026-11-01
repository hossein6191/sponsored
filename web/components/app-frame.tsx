"use client";

// The studio around every page: the header with the mark, the places to go and the wallet; the demo
// bar in mock mode; the wrong-chain banner; and the footer. Under 900 px the places fold into a menu, so
// the header fits a 375 px phone with no sideways scroll.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconMenu, IconX } from "@/components/icons";
import { Wordmark } from "@/components/logo";
import { MockBar } from "@/components/mock-bar";
import { WalletButton, WrongChainBanner } from "@/components/wallet";
import { EXPLORER_URL, contractInUse, isMock } from "@/lib/chain";
import { REPO_URL } from "@/lib/config";
import { cx } from "@/lib/cx";

const PLACES = [
  { href: "/brief/new", label: "Open a brief" },
  { href: "/mine", label: "My briefs" },
  { href: "/creator", label: "For creators" },
  { href: "/ledger", label: "Ledger" },
  { href: "/how", label: "How it works" },
];

const isHere = (path: string, href: string) => path === href || (href === "/mine" && path.startsWith("/brief/") && path !== "/brief/new");

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const [open, setOpen] = React.useState(false);
  const [lastPath, setLastPath] = React.useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setOpen(false);
  }
  const contract = contractInUse();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="min-w-0 shrink-0 no-underline" aria-label="Sponsored, home">
            <Wordmark />
          </Link>
          <nav aria-label="Places" className="hidden min-w-0 items-center gap-1 min-[900px]:flex">
            {PLACES.map((p) => {
              const here = isHere(path, p.href);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={here ? "page" : undefined}
                  className={cx("rounded-full px-3.5 py-1.5 text-[14.5px] font-semibold whitespace-nowrap no-underline", here ? "bg-ink text-white" : "text-ink-2 hover:bg-canvas-2 hover:text-ink")}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex min-w-0 items-center gap-2">
            {!isMock && <WalletButton />}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="places-menu"
              onClick={() => setOpen((o) => !o)}
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-white min-[900px]:hidden"
            >
              {open ? <IconX size={18} /> : <IconMenu size={18} />}
              <span className="sr-only">{open ? "Close the menu" : "Open the menu"}</span>
            </button>
          </div>
        </div>
        {open && (
          <nav id="places-menu" aria-label="Places" className="border-t border-line bg-canvas px-4 pt-2 pb-4 min-[900px]:hidden">
            <ul className="flex flex-col gap-1">
              {PLACES.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    aria-current={isHere(path, p.href) ? "page" : undefined}
                    className={cx("block rounded-2xl px-4 py-2.5 text-[16px] font-semibold no-underline", isHere(path, p.href) ? "bg-ink text-white" : "bg-white text-ink")}
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      {isMock && <MockBar />}
      <WrongChainBanner />
      <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-7 pb-16 sm:pt-10">
        {children}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-6 text-[13px] text-ink-3 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[640px]">
            Sponsored is a GenLayer Intelligent Contract on Studio (chain 61999). Every brand, blog and person in its demo is fictional, and its GEN is test GEN.
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {contract ? (
              isMock ? (
                <span className="mono">demo contract {contract.slice(0, 10)}…</span>
              ) : (
                <a className="link mono" href={`${EXPLORER_URL}/address/${contract}`} target="_blank" rel="noreferrer">
                  contract {contract.slice(0, 10)}…
                </a>
              )
            ) : (
              <span>contract not deployed yet</span>
            )}
            {REPO_URL && (
              <a className="link" href={REPO_URL} target="_blank" rel="noreferrer">
                Source
              </a>
            )}
            <Link className="link" href="/how">
              The rules
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
