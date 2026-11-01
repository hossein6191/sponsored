"use client";

// For creators: the credit that pays submit fees (deposit with chips, withdraw), the briefs offered to
// this address (accept or decline), the ones waiting for its post (submit with chips), and the held pay
// that can be released. One transaction at a time, followed in one waiting panel at the top.

import * as React from "react";
import Link from "next/link";

import { PageHead, StatusTag } from "@/components/bits";
import { BriefRow } from "@/components/brief-row";
import { Pill } from "@/components/button";
import { IconCheck, IconDrop, IconUndo, IconX } from "@/components/icons";
import { Placeholder, ReadError } from "@/components/read-state";
import { SubmitForm } from "@/components/submit-form";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { briefPath, calls, isMock, readBriefsOfWindow, readCredit } from "@/lib/chain";
import { clockTime, gen, pageName, span, tryAtto } from "@/lib/format";
import { readingGuide, sendingGuide, signGuide, type Guide } from "@/lib/guide";
import { MAX_SUBMITS, SUBMIT_FEE } from "@/lib/rules";
import { DEPOSIT_CHIPS } from "@/lib/suggestions";
import { rememberTx } from "@/lib/tx-memory";
import type { Brief, Call, TxStatus } from "@/lib/types";

type Doing = { call: Call; label: string; sign: Guide; sending: Guide; judged: boolean; brief: string };

export default function CreatorPage() {
  const me = useMe();
  return (
    <div>
      <PageHead kicker="For creators" title="Your creator desk.">
        Briefs made to your address, the post each one waits for, and the credit that pays for submissions. You are paid for the lines your post meets, once it has stayed up
        for the hold; a post that does not say it is sponsored is not paid.
      </PageHead>
      <WalletGate what="to see the briefs made to you">{me.address ? <Desk address={me.address} /> : null}</WalletGate>
    </div>
  );
}

function Desk({ address }: { address: string }) {
  const now = useNow();
  const demo = useDemoStatus();
  const read = useRead(() => readBriefsOfWindow(address), [address]);
  const credit = useRead(() => readCredit(address), [address]);
  useAfterTx(read.refresh);
  useAfterTx(credit.refresh);
  const [doing, setDoing] = React.useState<Doing | null>(null);
  const tx = useTx((s: TxStatus, hash: string) => {
    if (doing?.brief) rememberTx(doing.brief, hash, doing.label);
  });
  const busy = tx.sending || (!!tx.hash && !tx.final);
  const creditAtto = credit.data ? BigInt(credit.data.creditAtto) : null;

  const run = async (d: Doing) => {
    setDoing(d);
    await tx.start(d.call);
  };
  const plain = (b: Brief | null, call: Call, label: string, fn: "accept" | "decline" | "deposit" | "withdraw" | "release", feeAtto = b?.feeAtto ?? "0") =>
    run({
      call,
      label,
      judged: false,
      brief: b?.id ?? "",
      sign: signGuide({ fn, label: label.toLowerCase(), feeAtto, heldAtto: b?.heldAtto, mock: isMock }),
      sending: sendingGuide({ fn, target: b?.id ?? "", role: "creator", feeAtto, heldAtto: b?.heldAtto, mock: isMock }),
    });
  const submit = (b: Brief, url: string) =>
    run({
      call: calls.submit(b.id, url),
      label: `Submitting ${pageName(url) || "the post"} for ${b.id}`,
      judged: true,
      brief: b.id,
      sign: signGuide({ fn: "submit", label: `submitting ${pageName(url) || "the post"} for ${b.id}`, feeAtto: b.feeAtto, mock: isMock }),
      sending: readingGuide({ role: "creator", brief: b.id, page: pageName(url) || "the post", feeAtto: b.feeAtto, holdSeconds: b.holdSeconds, stage: "busy", mock: isMock }),
    });

  const rows = (read.data?.rows ?? []).filter((r) => r.role === "creator");
  const offered = rows.filter((r) => r.status === "offered" && now < r.publishBy);
  const waiting = rows.filter((r) => r.status === "accepted" && now < r.submitCloses && r.tries < MAX_SUBMITS);
  const releasable = rows.filter((r) => r.status === "held" && now >= r.holdUntil);
  const shown = new Set([...offered, ...waiting, ...releasable].map((r) => r.id));
  const rest = rows.filter((r) => !shown.has(r.id));

  return (
    <div className="flex flex-col gap-6">
      {doing && <TxStage tx={tx} label={doing.label} judged={doing.judged} sign={doing.sign} sending={doing.sending} />}

      <CreditCard
        creditAtto={creditAtto}
        error={credit.error && !credit.data ? credit.error : ""}
        onRetry={credit.retry}
        busy={busy}
        onDeposit={(atto) => void plain(null, calls.deposit(atto), `Depositing ${gen(atto)} of credit`, "deposit", atto.toString())}
        onWithdraw={() => void plain(null, calls.withdraw(), "Taking back your whole credit", "withdraw")}
      />

      {read.loading && !read.data ? (
        <div className="card p-5">
          <Placeholder lines={5} />
        </div>
      ) : read.error && !read.data ? (
        <ReadError detail={read.error} onRetry={read.retry} />
      ) : (
        <>
          <Section title="Offered to you" count={offered.length} empty="No brief is waiting for your answer.">
            {offered.map((b) => (
              <li key={b.id} className="card p-4 sm:p-5">
                <Head b={b} />
                <Lines b={b} />
                <p className="mt-2 text-[13.5px] text-ink-3">
                  Accept before {clockTime(b.publishBy, now)} ({span(b.publishBy - now)} from now). The post must stay up {span(b.holdSeconds)} before it is paid.
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <Pill icon={<IconCheck size={17} />} disabled={busy} onClick={() => void plain(b, calls.accept(b.id), `Accepting ${b.id}`, "accept")}>
                    Accept {gen(b.feeAtto)}
                  </Pill>
                  <Pill variant="ghost" icon={<IconX size={16} />} disabled={busy} onClick={() => void plain(b, calls.decline(b.id), `Declining ${b.id}`, "decline")}>
                    Decline
                  </Pill>
                </div>
              </li>
            ))}
          </Section>

          <Section title="Waiting for your post" count={waiting.length} empty="No accepted brief is waiting for a post.">
            {waiting.map((b) => (
              <li key={b.id} className="card p-4 sm:p-5">
                <Head b={b} />
                <Lines b={b} />
                <p className="mt-2 mb-3 text-[13.5px] text-ink-3">
                  Submissions close {clockTime(b.submitCloses, now)}. {b.tries > 0 ? "The last reading was unclear: one more try is allowed." : ""}
                </p>
                <SubmitForm
                  briefId={b.id}
                  prefix={b.postPrefix}
                  tries={b.tries}
                  creditAtto={creditAtto}
                  demoPosts={isMock || (!!demo?.prefix && b.postPrefix === demo.prefix)}
                  busy={busy}
                  onSubmit={(url) => void submit(b, url)}
                  onDeposit={(atto) => void plain(null, calls.deposit(atto), `Depositing ${gen(atto)} of credit`, "deposit", atto.toString())}
                />
              </li>
            ))}
          </Section>

          <Section title="Ready to release" count={releasable.length} empty="No held pay has finished its hold.">
            {releasable.map((b) => (
              <li key={b.id} className="card p-4 sm:p-5">
                <Head b={b} />
                <p className="mt-2 text-[14px] text-ink-2">The post stayed up for the whole hold. Anyone may release the pay; it can only go to you.</p>
                <Pill variant="mint" className="mt-3" icon={<IconCheck size={17} />} disabled={busy} onClick={() => void plain(b, calls.release(b.id), `Releasing ${gen(b.heldAtto)} for ${b.id}`, "release", b.heldAtto)}>
                  Release {gen(b.heldAtto)} to me
                </Pill>
              </li>
            ))}
          </Section>

          {rest.length > 0 && (
            <section aria-label="Everything else">
              <h2 className="text-[22px]">Everything else</h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {rest.map((b) => (
                  <BriefRow key={b.id} brief={b} role="creator" now={now} demoCreator={demo?.creator} mock={isMock} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-[22px]">
        {title} <span className="mono text-[16px] text-ink-3">{count}</span>
      </h2>
      {count ? <ul className="mt-3 flex flex-col gap-3">{children}</ul> : <p className="mt-3 rounded-2xl border-2 border-dashed border-line-strong p-4 text-[14px] text-ink-3">{empty}</p>}
    </section>
  );
}

function Head({ b }: { b: Brief }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={briefPath(b.id)} className="display link text-[19px]">
        {b.id}
      </Link>
      <StatusTag status={b.status} />
      <span className="mono ml-auto text-[15px] font-semibold">{gen(b.feeAtto)}</span>
    </div>
  );
}

function Lines({ b }: { b: Brief }) {
  return (
    <ul className="mt-2.5 flex flex-col gap-1 text-[14px]">
      {b.requirements.map((l, i) => (
        <li key={i} className="flex items-start gap-2">
          {i === 0 ? <span className="ad-badge shrink-0">#ad</span> : <span className="mono w-9 shrink-0 text-center text-[12px] text-ink-3">{i}</span>}
          <span className="min-w-0 text-ink-2">{l}</span>
        </li>
      ))}
    </ul>
  );
}

function CreditCard({
  creditAtto,
  error,
  onRetry,
  busy,
  onDeposit,
  onWithdraw,
}: {
  creditAtto: bigint | null;
  error: string;
  onRetry: () => void;
  busy: boolean;
  onDeposit: (atto: bigint) => void;
  onWithdraw: () => void;
}) {
  const [text, setText] = React.useState("0.02");
  const atto = tryAtto(text);
  if (error) return <ReadError detail={error} onRetry={onRetry} />;
  return (
    <section className="card grid gap-5 p-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:p-5" aria-labelledby="credit">
      <div>
        <p className="kicker text-ink-3">Your credit</p>
        <p id="credit" className="mono mt-1 text-[32px] leading-none font-semibold">
          {creditAtto === null ? "…" : gen(creditAtto)}
        </p>
        <p className="mt-2 text-[13.5px] text-ink-2">
          {creditAtto === null ? "Reading…" : `${(creditAtto / SUBMIT_FEE).toString()} submissions at ${gen(SUBMIT_FEE)} each.`} A clear reading keeps the fee in your credit; an
          unclear one moves it to the sponsor.
        </p>
        <Pill size="sm" variant="ghost" className="mt-3" icon={<IconUndo size={14} />} disabled={busy || !creditAtto} onClick={onWithdraw}>
          Withdraw it all
        </Pill>
      </div>
      <div>
        <label htmlFor="deposit" className="label">
          Deposit
        </label>
        <div className="flex items-center gap-2">
          <input id="deposit" className="field mono max-w-[180px]" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
          <span className="font-bold">GEN</span>
        </div>
        <Suggest label="Deposit suggestions" chips={DEPOSIT_CHIPS} onPick={setText} isOn={(v) => v === text} />
        <Pill variant="ink" className="mt-3" icon={<IconDrop size={16} />} disabled={busy || !atto || atto <= 0n} onClick={() => atto && onDeposit(atto)}>
          Deposit {atto ? gen(atto) : ""}
        </Pill>
      </div>
    </section>
  );
}
