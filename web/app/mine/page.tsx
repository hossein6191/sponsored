"use client";

// My briefs: the briefs the connected wallet sponsors and the ones it creates, newest first, each with
// the one line of lib/guide.ts that says what it waits for.

import * as React from "react";

import { PageHead } from "@/components/bits";
import { BriefRow } from "@/components/brief-row";
import { PillLink } from "@/components/button";
import { IconPlus } from "@/components/icons";
import { Placeholder, ReadError } from "@/components/read-state";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useAfterTx, useRead } from "@/components/use-read";
import { WalletGate } from "@/components/wallet-gate";
import { isMock, readBriefsOfWindow } from "@/lib/chain";
import type { Brief } from "@/lib/types";

export default function MinePage() {
  const me = useMe();
  return (
    <div>
      <PageHead kicker="My briefs" title="Everything you sponsor or create.">
        Each brief says what it is waiting for and where its money is right now.
      </PageHead>
      <WalletGate what="to see your briefs">{me.address ? <Lists address={me.address} /> : null}</WalletGate>
    </div>
  );
}

function Lists({ address }: { address: string }) {
  const now = useNow();
  const demo = useDemoStatus();
  const read = useRead(() => readBriefsOfWindow(address), [address]);
  useAfterTx(read.refresh);
  if (read.loading && !read.data)
    return (
      <div className="card p-5">
        <Placeholder lines={5} />
      </div>
    );
  if (read.error && !read.data) return <ReadError detail={read.error} onRetry={read.retry} />;
  const rows = read.data?.rows ?? [];
  const sponsored = rows.filter((r) => r.role === "sponsor");
  const created = rows.filter((r) => r.role === "creator");
  if (!rows.length)
    return (
      <div className="card flex flex-col items-start gap-4 p-6">
        <p className="display text-[22px]">No briefs yet.</p>
        <p className="text-ink-2">Open one to the demo creator and pick what it posts: the whole flow takes about fifteen minutes on Studio.</p>
        <PillLink href="/brief/new?demo=1" icon={<IconPlus size={18} />}>
          Open a demo brief
        </PillLink>
      </div>
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Group title="You sponsor" empty="You have not opened a brief yet." rows={sponsored} role="sponsor" now={now} demoCreator={demo?.creator} />
      <Group title="You create" empty="No brief has been made to this address yet." rows={created} role="creator" now={now} demoCreator={demo?.creator} />
      {read.data?.partial && <p className="text-[13px] text-ink-3 lg:col-span-2">Showing the newest {rows.length} of {read.data.total}.</p>}
    </div>
  );
}

function Group({ title, empty, rows, role, now, demoCreator }: { title: string; empty: string; rows: Brief[]; role: "sponsor" | "creator"; now: number; demoCreator?: string }) {
  return (
    <section aria-label={title}>
      <h2 className="text-[22px]">
        {title} <span className="mono text-[16px] text-ink-3">{rows.length}</span>
      </h2>
      {rows.length ? (
        <ul className="mt-3 flex flex-col gap-2.5">
          {rows.map((b) => (
            <BriefRow key={b.id} brief={b} role={role} now={now} demoCreator={demoCreator} mock={isMock} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border-2 border-dashed border-line-strong p-4 text-[14px] text-ink-3">{empty}</p>
      )}
    </section>
  );
}
