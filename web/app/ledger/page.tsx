"use client";

// The ledger: the contract's own totals, read from stats(), and every brief, newest first. The contract
// holds exactly the escrow of offered, accepted and held briefs plus every credit; the page shows both.

import * as React from "react";

import { PageHead, Tile } from "@/components/bits";
import { BriefRow } from "@/components/brief-row";
import { Placeholder, ReadError } from "@/components/read-state";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useAfterTx, useRead } from "@/components/use-read";
import { EXPLORER_URL, contractInUse, isMock, readBriefsWindow, readStats } from "@/lib/chain";
import { gen } from "@/lib/format";

export default function LedgerPage() {
  const now = useNow();
  const me = useMe();
  const demo = useDemoStatus();
  const stats = useRead(() => readStats(), []);
  const list = useRead(() => readBriefsWindow(), []);
  useAfterTx(stats.refresh);
  useAfterTx(list.refresh);
  const s = stats.data;
  const contract = contractInUse();

  return (
    <div className="flex flex-col gap-8">
      <PageHead kicker="Ledger" title="Every brief, every GEN.">
        {contract ? (
          isMock ? (
            <>The demo build&apos;s in-memory contract.</>
          ) : (
            <>
              Read live from{" "}
              <a className="link mono" href={`${EXPLORER_URL}/address/${contract}`} target="_blank" rel="noreferrer">
                {contract}
              </a>
              .
            </>
          )
        ) : (
          "The contract is not deployed yet."
        )}
      </PageHead>

      {stats.loading && !s ? (
        <div className="card p-5">
          <Placeholder lines={4} />
        </div>
      ) : stats.error && !s ? (
        <ReadError detail={stats.error} onRetry={stats.retry} />
      ) : s ? (
        <section aria-label="Totals" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Briefs" value={s.briefs} note={`${s.offered} waiting for accept · ${s.accepted} for a post`} tone="ink" />
            <Tile label="Held now" value={gen(s.heldAtto)} note={`${s.heldBriefs} held until release`} />
            <Tile label="Paid to creators" value={gen(s.toCreatorsAtto)} note={`${s.released} released`} tone="mint" />
            <Tile label="Back to sponsors" value={gen(s.toSponsorsAtto)} note={`${s.hiddenAds} hidden ads · ${s.nothingMet} nothing met`} tone="tomato" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Readings" value={s.submits} note={`${s.clear} clear · ${s.unclear} unclear · ${s.resubmits} re-submissions`} />
            <Tile label="Rechecks" value={s.rechecks} note={`${s.takenDown} found the post gone`} />
            <Tile label="Credit held" value={gen(s.creditAtto)} note={`${gen(s.depositedAtto)} deposited · ${gen(s.creditWithdrawnAtto)} withdrawn`} />
            <Tile label="Closed early" value={s.declined + s.withdrawn + s.expired} note={`${s.declined} declined · ${s.withdrawn} withdrawn · ${s.expired} expired`} />
          </div>
          <p className="rounded-2xl bg-white px-4 py-3 text-[13.5px] text-ink-2 ring-1 ring-line">
            The contract holds exactly the escrow of offered, accepted and held briefs ({gen(s.heldAtto)}) plus every credit ({gen(s.creditAtto)}). In all it has taken{" "}
            {gen(s.takenAtto)} in fees; submit fees moved to sponsors on unclear readings come to {gen(s.feesToSponsorsAtto)}; {s.refusedPayments} refused payments sent{" "}
            {gen(s.returnedAtto)} straight back.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="all">
        <h2 id="all" className="text-[26px]">
          Every brief
        </h2>
        {list.loading && !list.data ? (
          <div className="card mt-3 p-5">
            <Placeholder lines={5} />
          </div>
        ) : list.error && !list.data ? (
          <ReadError className="mt-3" detail={list.error} onRetry={list.retry} />
        ) : list.data && list.data.rows.length ? (
          <>
            <ul className="mt-3 grid gap-2.5 lg:grid-cols-2">
              {list.data.rows.map((b) => (
                <BriefRow
                  key={b.id}
                  brief={b}
                  role={me.address === b.sponsor ? "sponsor" : me.address === b.creator ? "creator" : "visitor"}
                  now={now}
                  demoCreator={demo?.creator}
                  mock={isMock}
                />
              ))}
            </ul>
            {list.data.partial && <p className="mt-3 text-[13px] text-ink-3">Showing the newest {list.data.rows.length} of {list.data.total}.</p>}
          </>
        ) : (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-line-strong p-4 text-[14px] text-ink-3">No brief has been opened yet.</p>
        )}
      </section>
    </div>
  );
}
