// One brief in a list: its id and status, the viewer's part in it, the fee, the agreed mask once there
// is one, and the one-line waiting copy of lib/guide.ts.

import Link from "next/link";

import { MaskChips } from "@/components/brief-card";
import { StatusTag } from "@/components/bits";
import { IconArrow } from "@/components/icons";
import { briefPath } from "@/lib/chain";
import { gen } from "@/lib/format";
import { briefInputOf, briefLine, type Role } from "@/lib/guide";
import type { Brief } from "@/lib/types";

export function BriefRow({ brief, role, now, demoCreator, mock }: { brief: Brief; role: Role; now: number; demoCreator?: string; mock?: boolean }) {
  const demo = !!demoCreator && brief.creator === demoCreator;
  const line = now > 0 ? briefLine(briefInputOf(brief, role, now, { demo, mock })) : "";
  return (
    <li>
      <Link href={briefPath(brief.id)} className="card group flex items-start gap-3 p-4 no-underline hover:border-ink">
        <span className="display grid size-12 shrink-0 place-items-center rounded-2xl bg-canvas-2 text-[15px]">{brief.id}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusTag status={brief.status} />
            {role !== "visitor" && <span className="text-[12px] font-bold text-ink-3 uppercase">{role === "sponsor" ? "you sponsor" : "you create"}</span>}
            {demo && <span className="rounded-full bg-mint-wash px-2 py-0.5 text-[11.5px] font-bold text-mint-ink">demo creator</span>}
            <span className="mono ml-auto text-[14px] font-semibold">{gen(brief.feeAtto)}</span>
          </span>
          <span className="mt-1.5 block text-[14px] leading-snug text-ink-2">{brief.requirements.slice(1).join(" · ")}</span>
          {line && <span className="mt-1.5 block text-[13px] text-ink-3">{line}</span>}
          {brief.mask && (
            <span className="mt-2 block">
              <MaskChips mask={brief.mask} />
            </span>
          )}
        </span>
        <IconArrow size={18} className="mt-1 shrink-0 text-ink-3 group-hover:text-tomato" />
      </Link>
    </li>
  );
}
