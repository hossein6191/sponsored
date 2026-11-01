// The brief as a checklist card: line 0, the contract's own disclosure, as a "#ad disclosure" badge, then
// the sponsor's lines. Once the network agrees on a mask, each line lights up mint (met) or stays tomato
// (not met); an unclear reading marks every line with a question; while a post is being read the lines
// wait with the reading dots.

import * as React from "react";

import { IconCheck, IconX } from "@/components/icons";
import { cx } from "@/lib/cx";

export type LineState = "open" | "reading" | "met" | "unmet" | "unclear" | "expected-met" | "expected-unmet";

/** Each line's state from a mask ("1101"), "unclear", or nothing yet. */
export function lineStates(count: number, mask: string, reading: boolean): LineState[] {
  return Array.from({ length: count }, (_, k) => {
    if (reading) return "reading";
    if (mask === "unclear") return "unclear";
    if (/^[01]+$/.test(mask) && mask.length === count) return mask[k] === "1" ? "met" : "unmet";
    return "open";
  });
}

function Mark({ state }: { state: LineState }) {
  const base = "grid size-7 shrink-0 place-items-center rounded-full border-2";
  switch (state) {
    case "met":
      return (
        <span className={cx(base, "lit border-ink bg-mint text-ink")} aria-label="met">
          <IconCheck size={15} />
        </span>
      );
    case "unmet":
      return (
        <span className={cx(base, "border-ink bg-tomato text-white")} aria-label="not met">
          <IconX size={14} />
        </span>
      );
    case "unclear":
      return (
        <span className={cx(base, "border-ink bg-ink-wash text-[13px] font-extrabold text-ink")} aria-label="unclear">
          ?
        </span>
      );
    case "reading":
      return (
        <span className={cx(base, "border-ink bg-white text-ink")} aria-label="being read">
          <span className="reading-dots scale-[0.6]">
            <span />
            <span />
            <span />
          </span>
        </span>
      );
    case "expected-met":
      return (
        <span className={cx(base, "border-dashed border-mint-deep bg-mint-wash text-mint-ink")} aria-label="should be met">
          <IconCheck size={13} />
        </span>
      );
    case "expected-unmet":
      return (
        <span className={cx(base, "border-dashed border-tomato bg-tomato-wash text-tomato-ink")} aria-label="should not be met">
          <IconX size={12} />
        </span>
      );
    default:
      return <span className={cx(base, "border-line-strong bg-white")} aria-label="not read yet" />;
  }
}

const ROW: Record<LineState, string> = {
  open: "bg-white",
  reading: "bg-white",
  met: "bg-mint-wash",
  unmet: "bg-tomato-wash",
  unclear: "bg-ink-wash/60",
  "expected-met": "bg-white",
  "expected-unmet": "bg-white",
};

export function BriefCard({
  title,
  lines,
  states,
  footer,
  header,
  className,
}: {
  title: React.ReactNode;
  /** every line, the disclosure first */
  lines: string[];
  states: LineState[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [disclosure, ...own] = lines;
  return (
    <section className={cx("card overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 pt-4 pb-3 sm:px-5">
        <h2 className="text-[20px]">{title}</h2>
        {header}
      </div>
      <ol className="flex flex-col gap-1.5 p-3 sm:p-4" aria-label="The brief's lines">
        <li className={cx("flex items-start gap-3 rounded-2xl border-2 border-ink px-3 py-2.5", ROW[states[0] ?? "open"])}>
          <Mark state={states[0] ?? "open"} />
          <div className="min-w-0">
            <span className="ad-badge">#ad disclosure</span>
            <p className="mt-1 text-[14.5px] leading-snug font-semibold text-ink">{disclosure}</p>
            <p className="mt-0.5 text-[12px] text-ink-3">Line 0, added by the contract to every brief. Not met is a hidden ad: nothing is paid.</p>
          </div>
        </li>
        {own.map((line, i) => (
          <li key={i} className={cx("flex items-start gap-3 rounded-2xl border border-line px-3 py-2.5", ROW[states[i + 1] ?? "open"])}>
            <Mark state={states[i + 1] ?? "open"} />
            <div className="min-w-0">
              <p className="mono text-[11px] text-ink-3">line {i + 1}</p>
              <p className="text-[14.5px] leading-snug break-words text-ink">{line}</p>
            </div>
          </li>
        ))}
      </ol>
      {footer && <div className="border-t border-line px-4 py-3 sm:px-5">{footer}</div>}
    </section>
  );
}

/** A mask drawn as its characters, each lit like its line. */
export function MaskChips({ mask }: { mask: string }) {
  if (!mask) return null;
  if (mask === "unclear") return <span className="mono rounded-full bg-ink-wash px-2 py-0.5 text-[12px] font-semibold">unclear</span>;
  return (
    <span className="inline-flex gap-0.5" aria-label={`mask ${mask}`}>
      {[...mask].map((c, i) => (
        <span key={i} className={cx("mono grid h-6 w-5 place-items-center rounded-md text-[12px] font-bold", c === "1" ? "bg-mint text-ink" : "bg-tomato text-white")}>
          {c}
        </span>
      ))}
    </span>
  );
}
