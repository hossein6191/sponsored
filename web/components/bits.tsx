// Small pieces every page uses: a brief's status as a tag, a number tile, a page heading, and the list
// of transactions this browser sent for a brief.

import * as React from "react";

import { IconExternal } from "@/components/icons";
import { isMock, txUrl } from "@/lib/chain";
import { ago } from "@/lib/format";
import type { BriefStatus } from "@/lib/rules";
import type { Remembered } from "@/lib/tx-memory";
import { cx } from "@/lib/cx";

export const STATUS_WORDS: Record<BriefStatus, string> = {
  offered: "Waiting for accept",
  accepted: "Waiting for the post",
  held: "Held until release",
  released: "Paid",
  taken_down: "Taken down",
  hidden_ad: "Hidden ad",
  nothing_met: "Nothing met",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const STATUS_STYLE: Record<BriefStatus, string> = {
  offered: "bg-ink-wash text-ink",
  accepted: "bg-ink-wash text-ink",
  held: "bg-mint-wash text-mint-ink ring-1 ring-mint-deep/50",
  released: "bg-mint text-ink",
  taken_down: "bg-tomato text-white",
  hidden_ad: "bg-tomato text-white",
  nothing_met: "bg-canvas-2 text-ink-2",
  declined: "bg-canvas-2 text-ink-2",
  withdrawn: "bg-canvas-2 text-ink-2",
  expired: "bg-canvas-2 text-ink-2",
};

export function StatusTag({ status, className }: { status: BriefStatus; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap", STATUS_STYLE[status], className)}>{STATUS_WORDS[status]}</span>;
}

export function Tile({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: string; tone?: "mint" | "tomato" | "ink" }) {
  return (
    <div className={cx("card min-w-0 p-4", tone === "ink" && "border-ink bg-ink text-white")}>
      <p className={cx("kicker", tone === "ink" ? "text-white/60" : "text-ink-3")}>{label}</p>
      <p className={cx("mono mt-1.5 text-[24px] leading-none font-semibold break-words", tone === "mint" && "text-mint-ink", tone === "tomato" && "text-tomato-ink")}>{value}</p>
      {note && <p className={cx("mt-1.5 text-[12.5px] leading-snug", tone === "ink" ? "text-white/70" : "text-ink-3")}>{note}</p>}
    </div>
  );
}

export function PageHead({ kicker, title, children }: { kicker?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-6 max-w-[760px]">
      {kicker && <p className="kicker text-tomato-ink">{kicker}</p>}
      <h1 className="mt-1.5 text-[34px] sm:text-[44px]">{title}</h1>
      {children && <div className="mt-3 text-[16.5px] leading-relaxed text-ink-2">{children}</div>}
    </header>
  );
}

export function TxList({ items, now }: { items: Remembered[]; now: number }) {
  if (!items.length) return null;
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="text-[18px]">Sent from this browser</h2>
      <p className="mt-1 text-[13px] text-ink-3">A contract does not know the hashes of the transactions that ran it; this browser does.</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((t) => (
          <li key={t.hash} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-xl bg-canvas px-3 py-2 text-[13.5px]">
            <span className="min-w-0">{t.label}</span>
            <a href={txUrl(t.hash)} target="_blank" rel="noreferrer" className="mono link inline-flex items-center gap-1 text-[12px] text-ink-2">
              {isMock ? "demo tx " : ""}
              {t.hash.slice(0, 10)}… · {ago(t.at, now)}
              <IconExternal size={11} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
