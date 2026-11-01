// Held pay as a progress bar to its release time: it fills mint from the reading to the end of the hold,
// on the contract's clock. Past the end it is full and says the pay can be released.

import { clockTime, gen, span } from "@/lib/format";
import { cx } from "@/lib/cx";

export function HoldBar({ heldAtto, holdUntil, holdSeconds, now, className }: { heldAtto: string; holdUntil: number; holdSeconds: number; now: number; className?: string }) {
  const start = holdUntil - holdSeconds;
  const done = now >= holdUntil;
  const pct = holdSeconds > 0 ? Math.max(0, Math.min(100, ((now - start) / holdSeconds) * 100)) : 100;
  return (
    <section className={cx("card p-4 sm:p-5", className)} aria-label="Held pay">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="display text-[17px]">Held for the creator</p>
        <p className="mono text-[20px] font-semibold">{gen(heldAtto)}</p>
      </div>
      <div
        className="relative mt-3 h-4 overflow-hidden rounded-full border-2 border-ink bg-canvas-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={done ? "the hold has ended" : `${span(holdUntil - now)} until release`}
      >
        <div className="hold-fill h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-[12.5px] text-ink-3">
        <span>
          read <span className="mono text-ink-2">{clockTime(start, now)}</span>
        </span>
        <span className={cx(done && "font-bold text-mint-ink")}>
          {done ? "hold ended: ready to release" : `${span(holdUntil - now)} to go`}
        </span>
        <span>
          release <span className="mono text-ink-2">{clockTime(holdUntil, now)}</span>
        </span>
      </div>
    </section>
  );
}
