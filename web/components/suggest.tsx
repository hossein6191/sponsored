"use client";

// A row of one-click suggestions under a field: press one and the field is filled with it. A chip may
// carry a small note (what it is for, or what the network should make of it).

import { cx } from "@/lib/cx";
import type { Chip } from "@/lib/suggestions";

export function Suggest<T>({ label, chips, onPick, isOn, className }: { label: string; chips: Chip<T>[]; onPick: (value: T) => void; isOn?: (value: T) => boolean; className?: string }) {
  if (!chips.length) return null;
  return (
    <div className={cx("mt-2 flex flex-wrap items-center gap-1.5", className)} role="group" aria-label={label}>
      {chips.map((c, i) => {
        const on = isOn?.(c.value) ?? false;
        return (
          <button key={i + ":" + c.label} type="button" aria-pressed={isOn ? on : undefined} onClick={() => onPick(c.value)} className="chip">
            <span className="chip-plus" aria-hidden="true">
              {on ? "✓" : "+"}
            </span>
            <span className="min-w-0 break-words">{c.label}</span>
            {c.tag && <span className="mono rounded-full bg-canvas-2 px-1.5 text-[10.5px] font-medium text-ink-3">{c.tag}</span>}
          </button>
        );
      })}
    </div>
  );
}
