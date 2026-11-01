"use client";

// One write, from the wallet prompt to the final line, in one place: while the wallet asks, the sign
// panel; while the transaction goes through, the page's own waiting panel (lib/guide.ts) above the
// rail with its explorer link; once it is final, the rail's last line; and a wallet error in words a
// person can act on. Every page that sends anything renders its writes through this.

import * as React from "react";

import { TxRail } from "@/components/tx-rail";
import type { TxRun } from "@/components/use-tx";
import { WaitPanel, waitOf } from "@/components/wait-panel";
import type { Guide } from "@/lib/guide";
import type { TxStatus } from "@/lib/types";

export function TxStage({
  tx,
  sign,
  sending,
  label,
  judged,
  scene,
  onStatus,
  hideFinal,
  className,
}: {
  tx: TxRun;
  /** the wallet-prompt guide for this call */
  sign: Guide;
  /** the guide while it goes through */
  sending: Guide;
  /** what the rail calls it */
  label: string;
  judged?: boolean;
  /** drawn inside the waiting panel while the call goes through */
  scene?: React.ReactNode;
  onStatus?: (s: TxStatus) => void;
  /** the page shows the outcome itself: the rail's final line is not needed */
  hideFinal?: boolean;
  className?: string;
}) {
  if (tx.sending)
    return (
      <div className={className}>
        <WaitPanel wait={waitOf(sign)} />
      </div>
    );
  if (tx.error)
    return (
      <p role="alert" className={`rounded-2xl border-[1.5px] border-tomato bg-tomato-wash px-3.5 py-2.5 text-sm text-tomato-ink ${className ?? ""}`}>
        {tx.error}
      </p>
    );
  if (!tx.hash) return null;
  if (tx.final && hideFinal) return null;
  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      {!tx.final && <WaitPanel wait={waitOf(sending, { since: tx.at || undefined, scene })} />}
      <TxRail hash={tx.hash} label={label} judged={judged} onDone={tx.onDone} onStatus={onStatus} />
    </div>
  );
}
