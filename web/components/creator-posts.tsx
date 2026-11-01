"use client";

// "What the creator posts": on a brief to the demo creator, one button per fixed post in posts/. Each
// says what the post does and the outcome the network should reach against this brief's lines, with
// the money it would move. Pressing one asks the demo creator to submit that post; the visitor's own
// words never travel with it.

import { MaskChips } from "@/components/brief-card";
import { Pill } from "@/components/button";
import { IconSend } from "@/components/icons";
import { DEMO_POSTS, OUTCOME_WORDS, expectedMask, outcomeOfMask, splitOf, type PostKey } from "@/lib/demo-creator";
import { gen } from "@/lib/format";
import { cx } from "@/lib/cx";

export function CreatorPosts({
  requirements,
  feeAtto,
  enabled,
  note,
  onPick,
  busy,
}: {
  /** the brief's lines, the disclosure first */
  requirements: string[];
  feeAtto: string;
  enabled: boolean;
  /** why the buttons are not pressable now, when they are not */
  note?: string;
  onPick: (key: PostKey) => void;
  busy?: boolean;
}) {
  const fee = BigInt(feeAtto || "0");
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="creator-posts">
      <p className="kicker text-tomato-ink">The demo creator</p>
      <h2 id="creator-posts" className="mt-1 text-[21px]">
        What the creator posts
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
        Four fixed versions of one Harbour Eats post, pinned to one commit so every validator fetches the same bytes. Pick one; the demo creator submits it and the network
        reads it against this brief.
      </p>
      {note && <p className="mt-2 rounded-2xl bg-canvas px-3 py-2 text-[13.5px] text-ink-2">{note}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {DEMO_POSTS.map((p) => {
          const mask = expectedMask(p, requirements);
          const outcome = mask ? outcomeOfMask(mask) : null;
          const split = mask ? splitOf(fee, mask) : null;
          return (
            <li key={p.key} className={cx("rounded-2xl border p-3.5", outcome === "hidden_ad" ? "border-tomato/50 bg-tomato-wash/50" : "border-line bg-canvas")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="display text-[16px]">{p.label}</p>
                  <p className="mt-0.5 text-[13.5px] text-ink-2">The post {p.says}.</p>
                </div>
                {mask && <MaskChips mask={mask} />}
              </div>
              <p className="mt-2 text-[13px] text-ink-2">
                {outcome && split ? (
                  <>
                    <strong className="text-ink">Should read: {OUTCOME_WORDS[outcome]}.</strong> {gen(split.owed)} to the creator{split.owed > 0n ? " after the hold" : ""},{" "}
                    {gen(split.back)} back to the sponsor{split.owed > 0n && split.back > 0n ? " at once" : ""}.
                  </>
                ) : (
                  <>This brief has lines the demo posts were not written for: the network reads the post against them as they are.</>
                )}
              </p>
              <Pill size="sm" variant={p.key === "full" ? "mint" : "ghost"} icon={<IconSend size={14} />} className="mt-2.5" disabled={!enabled || busy} onClick={() => onPick(p.key)}>
                Post {p.file}
              </Pill>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
