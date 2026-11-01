"use client";

// One brief: the waiting panel that says what is happening, how long, whether you must act, whether you
// can leave and where the money is, with the buttons that are open right now; the checklist whose lines
// light up mint or stay tomato from the agreed mask; the post in a phone frame once it is submitted, with
// its fingerprint; on a brief to the demo creator, "What the creator posts"; the held pay as a bar to
// its release; every reading; and where every atto went. Every transaction shows its explorer link from
// the first second.

import * as React from "react";
import { useParams } from "next/navigation";

import { PageHead, StatusTag, TxList } from "@/components/bits";
import { BriefCard, MaskChips, lineStates } from "@/components/brief-card";
import { Pill, PillLink } from "@/components/button";
import { CreatorPosts } from "@/components/creator-posts";
import { HoldBar } from "@/components/hold-bar";
import { IconCheck, IconEye, IconRefresh, IconUndo, IconX } from "@/components/icons";
import { DemoPostCard, EmptyPost, LinkPostCard, PhoneFrame } from "@/components/phone-post";
import { Addr } from "@/components/addr";
import { Placeholder, ReadError } from "@/components/read-state";
import { SubmitForm } from "@/components/submit-form";
import { TxStage } from "@/components/tx-stage";
import { useDemoStatus } from "@/components/use-demo";
import { useLocal } from "@/components/use-local";
import { useMe } from "@/components/use-me";
import { useNow, useWallNow } from "@/components/use-now";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WaitPanel, waitOf } from "@/components/wait-panel";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock, readBrief, readCredit, readingOutcome, recheckOutcome, requestDemoAccept, requestDemoPost, unsettledWhy } from "@/lib/chain";
import { isTakenDown, takeDown } from "@/lib/chain-mock";
import { postOf, postOfUrl, type PostKey } from "@/lib/demo-creator";
import { clockTime, gen, pageName, when } from "@/lib/format";
import { briefGuide, briefInputOf, demoGuide, readingGuide, recheckGuide, sendingGuide, signGuide, type Guide, type Role } from "@/lib/guide";
import { CLOSED, parseBriefId } from "@/lib/rules";
import { parseRemembered, rememberTx, rememberedRaw } from "@/lib/tx-memory";
import type { Brief, Call, TxStatus } from "@/lib/types";

const LATE_AFTER = 360;

export default function BriefPage() {
  const params = useParams<{ id: string }>();
  const id = parseBriefId(String(params?.id ?? ""));
  if (!id)
    return (
      <div className="card mx-auto max-w-[560px] p-6">
        <h1 className="text-[30px]">That is not a brief id</h1>
        <p className="mt-2 text-ink-2">Briefs are B1, B2 and so on. Yours are under My briefs.</p>
        <PillLink href="/mine" className="mt-4">
          My briefs
        </PillLink>
      </div>
    );
  return <Room key={id} id={id} />;
}

/** What one transaction of this page is doing, for its waiting panel. */
type Doing = { call: Call; label: string; sign: Guide; sending: Guide; judged: boolean };

function Room({ id }: { id: string }) {
  const me = useMe();
  const now = useNow();
  const wall = useWallNow();
  const demo = useDemoStatus();
  const read = useRead(() => readBrief(id), [id]);
  useAfterTx(read.refresh);
  const b = read.data;
  const role: Role = !b || !me.address ? "visitor" : me.address === b.sponsor ? "sponsor" : me.address === b.creator ? "creator" : "visitor";
  const credit = useRead(() => readCredit(me.address), [me.address, role === "creator"], { enabled: role === "creator" && !!me.address });
  useAfterTx(credit.refresh);
  const memory = parseRemembered(useLocal(() => rememberedRaw(id), ""));
  const [doing, setDoing] = React.useState<Doing | null>(null);
  const [demoState, setDemoState] = React.useState<{ state: "asking" | "failed"; what: string; reason?: string } | null>(null);
  const takenDown = useLocal(() => (isMock && b?.url ? isTakenDown(b.url) : false), false);

  const tx = useTx((s: TxStatus, hash: string, call: Call) => {
    rememberTx(id, hash, labelOf(call, s));
    void read.refresh();
  });

  if (read.loading && !b)
    return (
      <div className="card p-6">
        <Placeholder lines={6} />
      </div>
    );
  if (read.error && !b) return <ReadError detail={read.error} onRetry={read.retry} />;
  if (!b)
    return (
      <div className="card mx-auto max-w-[560px] p-6">
        <h1 className="text-[30px]">No brief {id} yet</h1>
        <p className="mt-2 text-ink-2">The contract holds no brief with this id. A brief opened a moment ago appears once its transaction is final.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Pill variant="ghost" icon={<IconRefresh size={16} />} onClick={read.retry}>
            Read again
          </Pill>
          <PillLink href="/brief/new">Open a brief</PillLink>
        </div>
      </div>
    );

  const isDemo = !!demo?.creator && b.creator === demo.creator;
  const can = b.can ?? { accept: false, submit: false, recheck: false, release: false, expire: false };
  const inFlight = tx.sending || (!!tx.hash && !tx.final);
  const busy = inFlight || demoState?.state === "asking";
  const submitting = inFlight && doing?.call.fn === "submit";
  const flightUrl = submitting ? String(doing?.call.args[1] ?? "") : "";
  const last = b.submissions[b.submissions.length - 1];
  const shownUrl = flightUrl || b.url || last?.url || "";
  const shownPost = shownUrl ? postOfUrl(shownUrl) : null;
  const shownMask = submitting ? "" : b.mask || last?.mask || "";
  const states = lineStates(b.requirements.length, shownMask, submitting);
  const holdNow = Math.max(now, 0);
  const input = briefInputOf(b, role, holdNow, { demo: isDemo, mock: isMock });

  const run = async (d: Doing) => {
    setDoing(d);
    setDemoState(null);
    await tx.start(d.call);
  };

  const plain = (call: Call, label: string, fn: "withdraw_brief" | "decline" | "accept" | "release" | "expire" | "deposit", feeAtto = b.feeAtto) =>
    run({
      call,
      label,
      judged: false,
      sign: signGuide({ fn, label: label.toLowerCase(), feeAtto, heldAtto: b.heldAtto, mock: isMock }),
      sending: sendingGuide({ fn, target: id, role, feeAtto, heldAtto: b.heldAtto, mock: isMock }),
    });

  const submit = (url: string) =>
    run({
      call: calls.submit(id, url),
      label: `Submitting ${pageName(url) || "the post"} for ${id}`,
      judged: true,
      sign: signGuide({ fn: "submit", label: `submitting ${pageName(url) || "the post"}`, feeAtto: b.feeAtto, mock: isMock }),
      sending: readingGuide({ role, brief: id, page: pageName(url) || "the post", feeAtto: b.feeAtto, holdSeconds: b.holdSeconds, stage: "busy", mock: isMock }),
    });

  const recheck = () =>
    run({
      call: calls.recheck(id),
      label: `Rechecking the post of ${id}`,
      judged: true,
      sign: signGuide({ fn: "recheck", label: "rechecking the post", heldAtto: b.heldAtto, mock: isMock }),
      sending: recheckGuide({ role, brief: id, heldAtto: b.heldAtto, stage: "busy", mock: isMock }),
    });

  const askDemo = async (what: "accept" | PostKey) => {
    const label = what === "accept" ? `accepting ${id}` : `submitting ${postOf(what).file} for ${id}`;
    setDemoState({ state: "asking", what: label });
    const answer = what === "accept" ? await requestDemoAccept(id) : await requestDemoPost(id, what);
    if (!answer.ok) {
      setDemoState({ state: "failed", what: label, reason: answer.reason });
      return;
    }
    setDemoState(null);
    if (answer.deposit) rememberTx(id, answer.deposit, "The demo creator topped up its credit");
    if (what === "accept") {
      setDoing({ call: calls.accept(id), label: `The demo creator accepts ${id}`, judged: false, sign: signGuide({ fn: "accept", label, mock: isMock }), sending: sendingGuide({ fn: "accept", target: id, role, feeAtto: b.feeAtto, mock: isMock }) });
      tx.track(answer.hash, calls.accept(id));
    } else {
      const page = postOf(what).file;
      const call = calls.submit(id, (demo?.prefix ?? "") + page);
      setDoing({
        call,
        label: `The demo creator submits ${page}`,
        judged: true,
        sign: signGuide({ fn: "submit", label, mock: isMock }),
        sending: readingGuide({ role, brief: id, page, feeAtto: b.feeAtto, holdSeconds: b.holdSeconds, stage: "busy", mock: isMock }),
      });
      tx.track(answer.hash, call);
    }
  };

  // The one panel: a transaction in flight, the demo creator at work, or the brief's own state.
  const late = !!tx.at && wall - tx.at > LATE_AFTER;
  const sendingNow: Guide | null = doing
    ? doing.call.fn === "submit"
      ? readingGuide({ role, brief: id, page: pageName(String(doing.call.args[1] ?? "")) || "the post", feeAtto: b.feeAtto, holdSeconds: b.holdSeconds, stage: late ? "late" : "busy", mock: isMock })
      : doing.call.fn === "recheck"
        ? recheckGuide({ role, brief: id, heldAtto: b.heldAtto, stage: late ? "late" : "busy", mock: isMock })
        : doing.sending
    : null;
  const stateGuide = now > 0 ? briefGuide(input) : null;
  const unsettled = tx.final ? unsettledWhy(tx.final) : "";
  const reading = tx.final ? readingOutcome(tx.final) : null;
  const rechecked = tx.final ? recheckOutcome(tx.final) : null;

  const actions = (
    <WalletGate what="to act on this brief">
      <div className="flex flex-wrap gap-2.5">
        {b.status === "offered" && role === "creator" && can.accept && (
          <Pill icon={<IconCheck size={17} />} disabled={busy} onClick={() => void plain(calls.accept(id), `Accepting ${id}`, "accept")}>
            Accept the brief
          </Pill>
        )}
        {b.status === "offered" && role === "creator" && (
          <Pill variant="ghost" icon={<IconX size={16} />} disabled={busy} onClick={() => void plain(calls.decline(id), `Declining ${id}`, "decline")}>
            Decline
          </Pill>
        )}
        {b.status === "offered" && isDemo && role !== "creator" && can.accept && (
          <Pill icon={<IconCheck size={17} />} disabled={busy} onClick={() => void askDemo("accept")}>
            Ask the demo creator to accept
          </Pill>
        )}
        {b.status === "offered" && role === "sponsor" && (
          <Pill variant="ghost" icon={<IconUndo size={16} />} disabled={busy} onClick={() => void plain(calls.withdrawBrief(id), `Withdrawing ${id}`, "withdraw_brief")}>
            Withdraw and take the fee back
          </Pill>
        )}
        {can.release && (
          <Pill variant="mint" icon={<IconCheck size={17} />} disabled={busy} onClick={() => void plain(calls.release(id), `Releasing ${gen(b.heldAtto)} to the creator`, "release", b.heldAtto)}>
            Release {gen(b.heldAtto)} to the creator
          </Pill>
        )}
        {can.recheck && (
          <Pill variant="ghost" icon={<IconEye size={16} />} disabled={busy} onClick={() => void recheck()}>
            Recheck that the post is up
          </Pill>
        )}
        {can.expire && (
          <Pill variant={role === "sponsor" ? "tomato" : "ghost"} icon={<IconUndo size={16} />} disabled={busy} onClick={() => void plain(calls.expire(id), `Expiring ${id}`, "expire")}>
            Expire: the fee goes back to the sponsor
          </Pill>
        )}
      </div>
    </WalletGate>
  );
  const hasActions =
    (b.status === "offered" && (role === "creator" || role === "sponsor" || (isDemo && can.accept))) || can.release || can.recheck || can.expire;

  const panel = inFlight && doing ? null : demoState ? (
    <WaitPanel wait={waitOf(demoGuide({ ...demoState, brief: id, feeAtto: b.feeAtto, mock: isMock }), { action: demoState.state === "failed" ? <Pill size="sm" variant="ghost" onClick={() => setDemoState(null)}>Back to the brief</Pill> : undefined })} />
  ) : stateGuide ? (
    <WaitPanel wait={waitOf(stateGuide, { action: hasActions ? actions : undefined })} />
  ) : (
    <div className="card p-5">
      <Placeholder lines={3} />
    </div>
  );

  const postNote = !isDemo
    ? ""
    : b.status === "offered"
      ? "The buttons open once the demo creator has accepted the brief."
      : b.status === "accepted" && !can.submit
        ? "This brief takes no more submissions."
        : "";

  return (
    <div>
      <PageHead kicker={isDemo ? "A brief to the demo creator" : "A brief"} title={<>Brief {id}</>}>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px]">
          <StatusTag status={b.status} />
          <span>
            <span className="text-ink-3">sponsor</span> <Addr address={b.sponsor} you={role === "sponsor"} />
          </span>
          <span>
            <span className="text-ink-3">creator</span> <Addr address={b.creator} you={role === "creator"} />
          </span>
          <span className="mono font-semibold">{gen(b.feeAtto)}</span>
        </span>
      </PageHead>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {panel}
          {doing && (
            <TxStage
              tx={tx}
              label={doing.label}
              judged={doing.judged}
              sign={doing.sign}
              sending={sendingNow ?? doing.sending}
            />
          )}
          {tx.final && unsettled && (
            <p className="rounded-2xl bg-tomato-wash px-4 py-3 text-[14px] text-tomato-ink">
              {unsettled} Nothing was stored and no fee was taken{b.status === "accepted" ? "; the post may be submitted again" : ""}.
            </p>
          )}
          {reading && (
            <p className="rounded-2xl bg-mint-wash px-4 py-3 text-[14px] text-mint-ink">
              The network agreed: <MaskChips mask={reading.mask} /> {reading.mask === "unclear" ? "No money moved; one more submission is allowed." : `${reading.met} of ${reading.of} lines met.`}
            </p>
          )}
          {rechecked && (
            <p className={rechecked.up === "gone" ? "rounded-2xl bg-tomato-wash px-4 py-3 text-[14px] text-tomato-ink" : "rounded-2xl bg-mint-wash px-4 py-3 text-[14px] text-mint-ink"}>
              {rechecked.up === "gone" ? `The post is gone: ${gen(rechecked.toSponsorAtto)} went back to the sponsor.` : "The post is still up; nothing moved."}
            </p>
          )}

          <BriefCard
            title="The brief"
            lines={b.requirements}
            states={states}
            header={shownMask ? <MaskChips mask={shownMask} /> : undefined}
            footer={
              <p className="text-[13px] text-ink-3">
                {submitting
                  ? "Every validator is reading the post against these lines right now."
                  : b.mask
                    ? `Agreed ${when(last?.at)}: ${b.mask[0] === "1" ? `disclosed, ${b.met} of ${b.of} lines met` : "not disclosed, a hidden ad"}.`
                    : last?.mask === "unclear"
                      ? "The last reading was unclear: no line is decided."
                      : "No post has been read yet."}
              </p>
            }
          />

          {b.status === "held" && <HoldBar heldAtto={b.heldAtto} holdUntil={b.holdUntil} holdSeconds={b.holdSeconds} now={holdNow} />}
          {isMock && b.status === "held" && can.recheck && !takenDown && (
            <p className="rounded-2xl border-2 border-dashed border-line-strong px-4 py-3 text-[13.5px] text-ink-2">
              Demo build: a pinned post never disappears, so a recheck finds it up.{" "}
              <button type="button" className="link font-semibold" onClick={() => takeDown(b.url)}>
                Take this post down
              </button>{" "}
              and recheck to see the held part go back to the sponsor.
            </p>
          )}

          {role === "creator" && b.status === "accepted" && can.submit && (
            <section className="card p-4 sm:p-5" aria-labelledby="submit-post">
              <h2 id="submit-post" className="text-[20px]">
                Submit your post
              </h2>
              <p className="mt-1 mb-3 text-[14px] text-ink-2">
                Below <span className="mono break-all">{b.postPrefix}</span>. Every validator fetches it and reads it against the brief.
              </p>
              <WalletGate what="to submit">
                <SubmitForm
                  briefId={id}
                  prefix={b.postPrefix}
                  tries={b.tries}
                  creditAtto={credit.data ? BigInt(credit.data.creditAtto) : null}
                  demoPosts={isMock || (!!demo?.prefix && b.postPrefix === demo.prefix)}
                  busy={busy}
                  onSubmit={(url) => void submit(url)}
                  onDeposit={(atto) => void plain(calls.deposit(atto), `Depositing ${gen(atto)} of credit`, "deposit", atto.toString())}
                />
              </WalletGate>
            </section>
          )}

          <Readings brief={b} now={now} />
          <Money brief={b} now={now} />
          <TxList items={memory} now={wall || now} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          <PhoneFrame label="The post">
            {shownPost ? (
              <DemoPostCard post={shownPost} time={last?.at ? clockTime(last.at, now) : undefined} />
            ) : shownUrl ? (
              <LinkPostCard url={shownUrl} />
            ) : CLOSED.includes(b.status) ? (
              <EmptyPost title="No post" line="This brief closed before a post was read." />
            ) : b.status === "offered" ? (
              <EmptyPost title="No post yet" line="The creator has not accepted the brief yet." />
            ) : (
              <EmptyPost title="Waiting for the post" line={`It goes up below ${b.postPrefix}`} />
            )}
          </PhoneFrame>
          {(submitting || last) && (
            <p className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-ink-2">
              {submitting ? (
                <span className="rounded-full bg-ink px-3 py-1 font-semibold text-white">being read by every validator now</span>
              ) : (
                <>
                  <span className="mono rounded-full bg-white px-3 py-1 ring-1 ring-line">fp {last?.fp || "–"}</span>
                  <span>read {clockTime(last?.at ?? 0, now)}</span>
                </>
              )}
            </p>
          )}
          {isDemo && (b.status === "offered" || b.status === "accepted") && (
            <CreatorPosts requirements={b.requirements} feeAtto={b.feeAtto} enabled={b.status === "accepted" && can.submit} note={postNote} busy={busy} onPick={(k) => void askDemo(k)} />
          )}
        </div>
      </div>
    </div>
  );
}

/** A line for this browser's memory of a finished transaction. */
function labelOf(call: Call, s: TxStatus): string {
  const r = readingOutcome(s);
  if (call.fn === "submit") return r ? `Submitted ${pageName(String(call.args[1] ?? ""))}: ${r.mask}` : `Submitted ${pageName(String(call.args[1] ?? ""))}: nothing stored`;
  const c = recheckOutcome(s);
  if (call.fn === "recheck") return c ? `Rechecked: ${c.up === "gone" ? "gone" : "still up"}` : "Rechecked: nothing stored";
  const words: Record<string, string> = { open_brief: "Opened", withdraw_brief: "Withdrew", decline: "Declined", accept: "Accepted", deposit: "Deposited credit", withdraw: "Withdrew credit", release: "Released", expire: "Expired" };
  return words[call.fn] ?? call.fn;
}

function Readings({ brief, now }: { brief: Brief; now: number }) {
  if (!brief.submissions.length) return null;
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="readings">
      <h2 id="readings" className="text-[20px]">
        Every reading
      </h2>
      <ol className="mt-3 flex flex-col gap-2">
        {brief.submissions.map((s, i) => (
          <li key={i} className="rounded-2xl bg-canvas p-3 text-[13.5px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">Try {i + 1}</span>
              <MaskChips mask={s.mask} />
            </div>
            <p className="mono mt-1.5 text-[12px] break-all text-ink-2">{s.url}</p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              fingerprint <span className="mono">{s.fp}</span> · {clockTime(s.at, now)}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {brief.requirements.map((line, k) => (
                <li key={k} className="flex items-start gap-2 text-[13px]">
                  <span className={s.mask === "unclear" ? "mono w-14 shrink-0 text-ink-3" : s.mask[k] === "1" ? "mono w-14 shrink-0 font-bold text-mint-ink" : "mono w-14 shrink-0 font-bold text-tomato-ink"}>
                    {s.mask === "unclear" ? "?" : s.mask[k] === "1" ? "met" : "not met"}
                  </span>
                  <span className="min-w-0">{k === 0 ? <span className="ad-badge">#ad</span> : line}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Money({ brief, now }: { brief: Brief; now: number }) {
  const rows: [string, string][] = [
    ["Fee sent with the brief", gen(brief.feeAtto)],
    ["Held by the contract now", gen(brief.heldAtto)],
    ["Paid to the creator", gen(brief.toCreatorAtto)],
    ["Back to the sponsor", gen(brief.toSponsorAtto)],
    ["Submit fees to the sponsor", gen(brief.feesToSponsorAtto)],
  ];
  const terms: [string, string][] = [
    ["Creator's site", brief.postPrefix],
    ["Post up by", when(brief.publishBy)],
    ["Submissions close", when(brief.submitCloses)],
    ["Stays up for", `${Math.round(brief.holdSeconds / 60)} minutes`],
    ["Opened", when(brief.openedAt)],
  ];
  if (brief.acceptedAt) terms.push(["Accepted", when(brief.acceptedAt)]);
  if (brief.holdUntil) terms.push(["Release from", when(brief.holdUntil)]);
  if (brief.rechecks) terms.push(["Rechecks", `${brief.rechecks}, last ${clockTime(brief.recheckedAt, now)}: ${brief.up === "gone" ? "gone" : "still up"}`]);
  if (brief.closedAt) terms.push(["Closed", when(brief.closedAt)]);
  return (
    <section className="card grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
      <div>
        <h2 className="text-[18px]">The money</h2>
        <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-[13.5px]">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-ink-2">{k}</dt>
              <dd className="mono text-right font-semibold">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
      <div className="min-w-0">
        <h2 className="text-[18px]">The terms</h2>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13.5px]">
          {terms.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-ink-3">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </section>
  );
}
