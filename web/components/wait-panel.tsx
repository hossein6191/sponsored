"use client";

// The waiting panel: a studio note pinned where the action happens. What is happening now, in one line,
// then four small tiles (how long, whether you must act, whether you can leave, where the money is), a
// countdown or an elapsed counter, and the button when there is one. The words come from lib/guide.ts,
// the same for every in-between state of the site. The panel scrolls itself into view when a busy state
// first appears (a calm state never moves the page). Five tones: busy (a transaction or the demo creator
// at work), wait (the brief waits for someone), late (slower than it should be, or a window missed),
// ready (something can be done now) and done (closed: where the money ended up).

import * as React from "react";

import { IconCheck, IconClock, IconCoins, IconDoor, IconFlag, IconHand } from "@/components/icons";
import { useWallNow } from "@/components/use-now";
import { cx } from "@/lib/cx";
import type { Guide, GuideTone } from "@/lib/guide";

export type WaitLines = { time: string; need: string; mustAct: boolean; leave: string; canLeave: boolean; money: string };

export type Wait = {
  /** a stable name for the state, e.g. "reading"; written on the panel for tests and tools */
  id: string;
  tone: GuideTone;
  kicker?: string;
  title: string;
  body?: React.ReactNode;
  lines?: WaitLines;
  /** browser-clock seconds when the wait began: an elapsed counter runs from it */
  since?: number;
  /** seconds left on the contract's clock: a countdown in place of the elapsed counter */
  left?: number;
  leftLabel?: string;
  link?: { href: string; label: string };
  action?: React.ReactNode;
  /** anything shown between the title and the tiles */
  scene?: React.ReactNode;
};

/** A guide from lib/guide.ts as a panel, with what only the page has: the button, the link, the counter's start. */
export function waitOf(g: Guide, extra: Pick<Wait, "action" | "link" | "since" | "scene"> = {}): Wait {
  return {
    id: g.id,
    tone: g.tone,
    kicker: g.kicker,
    title: g.now,
    body: g.note || undefined,
    lines: { time: g.time, need: g.need, mustAct: g.mustAct, leave: g.leave, canLeave: g.canLeave, money: g.money },
    left: g.left !== undefined && g.left > 0 ? g.left : undefined,
    leftLabel: g.leftLabel,
    ...extra,
  };
}

/** "0:42", "12:05", "1:02:09"; longer than a day, "2 d 3 h". */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  if (d > 0) {
    const h = Math.floor((s % 86400) / 3600);
    return h ? `${d} d ${h} h` : `${d} d`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const BADGE: Record<GuideTone, string> = {
  busy: "bg-ink text-white",
  wait: "bg-ink-wash text-ink",
  late: "bg-tomato-wash text-tomato-ink",
  ready: "bg-tomato text-white",
  done: "bg-mint-wash text-mint-ink",
};

const STRIP: Record<GuideTone, string> = {
  busy: "bg-ink",
  wait: "bg-ink-3/40",
  late: "bg-tomato",
  ready: "bg-tomato",
  done: "bg-mint",
};

function Badge({ tone }: { tone: GuideTone }) {
  return (
    <span aria-hidden="true" className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", BADGE[tone])}>
      {tone === "busy" ? (
        <span className="reading-dots">
          <span />
          <span />
          <span />
        </span>
      ) : tone === "done" ? (
        <IconCheck size={20} />
      ) : tone === "late" ? (
        <IconFlag size={19} />
      ) : tone === "ready" ? (
        <IconHand size={20} />
      ) : (
        <IconClock size={20} />
      )}
    </span>
  );
}

export function WaitPanel({ wait, className }: { wait: Wait; className?: string }) {
  const ref = React.useRef<HTMLElement>(null);
  const wall = useWallNow();

  React.useEffect(() => {
    const el = ref.current;
    if (wait.tone !== "busy" || !el || typeof el.scrollIntoView !== "function") return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [wait.id, wait.tone]);

  const counter =
    wait.left !== undefined
      ? { text: clockText(wait.left), label: wait.leftLabel ?? "left" }
      : wait.since && wall
        ? { text: clockText(wall - wait.since), label: "elapsed" }
        : null;
  const lines = wait.lines;

  return (
    <section ref={ref} data-wait={wait.id} className={cx("card scroll-mt-4 scroll-mb-4 overflow-hidden", className)}>
      <div className={cx("h-1.5", STRIP[wait.tone])} aria-hidden="true" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Badge tone={wait.tone} />
          <div className="min-w-0 flex-1" role="status" aria-live="polite" aria-atomic="true">
            <p className={cx("kicker", wait.tone === "late" || wait.tone === "ready" ? "text-tomato-ink" : wait.tone === "done" ? "text-mint-ink" : "text-ink-3")}>{wait.kicker}</p>
            <p className="display mt-1 text-[19px] leading-snug text-ink">{wait.title}</p>
          </div>
          {counter && (
            <div className="hidden shrink-0 rounded-2xl bg-ink px-3 py-2 text-right sm:block">
              <p className="mono text-[22px] leading-none font-semibold text-white">{counter.text}</p>
              <p className="mt-1 text-[10.5px] font-bold tracking-[0.08em] text-white/65 uppercase">{counter.label}</p>
            </div>
          )}
        </div>
        {counter && (
          <p className="mt-3 inline-flex items-baseline gap-2 rounded-full bg-ink px-3 py-1 text-white sm:hidden">
            <span className="mono text-[17px] font-semibold">{counter.text}</span>
            <span className="text-[10.5px] font-bold tracking-[0.08em] text-white/65 uppercase">{counter.label}</span>
          </p>
        )}
        {wait.scene && <div className="mt-4">{wait.scene}</div>}
        {wait.body && <div className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{wait.body}</div>}
        {lines && (
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <Tile icon={<IconClock size={15} />} label="How long">
              {lines.time}
            </Tile>
            <Tile icon={<IconHand size={15} />} label={lines.mustAct ? "You need to act" : "Your part"} hot={lines.mustAct}>
              {lines.need}
            </Tile>
            <Tile icon={<IconDoor size={15} />} label={lines.canLeave ? "Can you leave? Yes" : "Can you leave? Not yet"} hot={!lines.canLeave}>
              {lines.leave}
            </Tile>
            <Tile icon={<IconCoins size={15} />} label="The money">
              {lines.money}
            </Tile>
          </dl>
        )}
        {(wait.action || wait.link) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            {wait.action}
            {wait.link && (
              <a href={wait.link.href} target="_blank" rel="noreferrer" className="link text-[13.5px] text-ink-2">
                {wait.link.label}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Tile({ icon, label, children, hot }: { icon: React.ReactNode; label: string; children: React.ReactNode; hot?: boolean }) {
  return (
    <div className={cx("min-w-0 rounded-2xl px-3.5 py-2.5", hot ? "bg-tomato-wash" : "bg-canvas")}>
      <dt className={cx("flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.08em] uppercase", hot ? "text-tomato-ink" : "text-ink-3")}>
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-[14px] leading-[1.45] text-ink-2">{children}</dd>
    </div>
  );
}
