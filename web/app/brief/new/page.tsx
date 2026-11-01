"use client";

// Open a brief: to the demo creator (its address and its site filled in, the demo lines and the short
// demo windows one press away) or to any creator's address; the lines with chips, the fee, the windows.
// Every field says what the contract would refuse, in the contract's own words, before anything is
// signed; the brief's page opens by itself once the transaction is final.

import * as React from "react";
import { useRouter } from "next/navigation";

import { PageHead } from "@/components/bits";
import { BriefCard } from "@/components/brief-card";
import { Pill } from "@/components/button";
import { IconPlus, IconX } from "@/components/icons";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useSearchString } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { briefPath, calls, isMock, openedBrief, paidOutcome } from "@/lib/chain";
import { DEMO_CREATOR_NAME, DEMO_FEE_GEN, DEMO_LINES, DEMO_WINDOWS } from "@/lib/demo-creator";
import { clockTime, durationLabel, gen, tryAtto } from "@/lib/format";
import { sendingGuide, signGuide } from "@/lib/guide";
import { DISCLOSURE, MAX_REQUIREMENT, MAX_REQUIREMENTS, openProblem, sentence } from "@/lib/rules";
import { CREATOR_CHIPS, DEMO_LINES_CHIP, FEE_CHIPS, HOLD_CHIPS, LINE_CHIPS, PREFIX_CHIPS, PUBLISH_CHIPS } from "@/lib/suggestions";
import { rememberTx } from "@/lib/tx-memory";
import type { TxStatus } from "@/lib/types";
import { cx } from "@/lib/cx";

type Mode = "demo" | "any";

export default function NewBriefPage() {
  const search = useSearchString();
  const wantsAny = /(?:^|[?&])creator=any(?:&|$)/.test(search);
  const [modeChoice, setMode] = React.useState<Mode | null>(null);
  const mode: Mode = modeChoice ?? (wantsAny ? "any" : "demo");
  const demo = useDemoStatus();
  const me = useMe();
  const now = useNow();
  const router = useRouter();

  const [creator, setCreator] = React.useState("");
  const [prefix, setPrefix] = React.useState("");
  const [lines, setLines] = React.useState<string[]>(mode === "demo" ? [...DEMO_LINES] : [""]);
  const [feeText, setFeeText] = React.useState(DEMO_FEE_GEN);
  const [publishIn, setPublishIn] = React.useState(DEMO_WINDOWS.publishSeconds);
  const [hold, setHold] = React.useState(DEMO_WINDOWS.holdSeconds);
  const [touched, setTouched] = React.useState(false);

  const creatorAddr = mode === "demo" ? (demo?.creator ?? "") : creator.trim().toLowerCase();
  const sitePrefix = mode === "demo" ? (demo?.prefix ?? "") : prefix.trim();
  const cleanLines = lines.map((l) => l.trim()).filter(Boolean);
  const feeAtto = tryAtto(feeText);
  const demoReady = !!demo && !!demo.creator && !!demo.prefix && (demo.online || isMock);

  const problem =
    now > 0
      ? feeAtto === null
        ? "Enter the fee as a number of GEN, like 0.9."
        : sentence(
            openProblem({
              sponsor: me.address,
              creator: creatorAddr,
              prefix: sitePrefix,
              requirementsJson: JSON.stringify(cleanLines),
              feeAtto,
              holdSeconds: hold,
              publishBy: now + publishIn,
              now,
            }),
          )
      : "";
  const demoProblem = mode === "demo" && !demoReady ? demoWhy(demo) : "";

  const tx = useTx((s: TxStatus, hash: string) => {
    const id = openedBrief(s);
    if (id) {
      rememberTx(id, hash, `Opened ${id} for ${gen(feeAtto ?? 0n)}`);
      router.push(briefPath(id));
    }
  });
  const refused = tx.final ? paidOutcome(tx.final) : null;

  const open = async () => {
    setTouched(true);
    if (problem || demoProblem || feeAtto === null) return;
    await tx.start(calls.openBrief(creatorAddr, sitePrefix, cleanLines, now + publishIn, hold, feeAtto));
  };

  const setLine = (i: number, v: string) => setLines((ls) => ls.map((l, k) => (k === i ? v : l)));
  const addLine = (v = "") =>
    setLines((ls) => {
      const kept = ls.filter((l) => l.trim());
      if (v && kept.includes(v)) return ls;
      return kept.length >= MAX_REQUIREMENTS ? kept : [...kept, v];
    });
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, k) => k !== i) : [""]));
  const per = feeAtto && cleanLines.length ? feeAtto / BigInt(cleanLines.length) : 0n;
  const busy = tx.sending || (!!tx.hash && !tx.final);

  return (
    <div>
      <PageHead kicker="Open a brief" title="What must the post show?">
        You are the sponsor. Name the creator and their site, write what the post must do, one check per line, and send the fee. The contract holds it and adds line 0, the
        #ad disclosure, by itself.
      </PageHead>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col gap-4">
          <section className="card p-4 sm:p-5" aria-labelledby="who">
            <h2 id="who" className="text-[20px]">
              1. Who creates the post
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-canvas-2 p-1" role="radiogroup" aria-label="Creator">
              {(["demo", "any"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => {
                    setMode(m);
                    if (m === "demo") {
                      setLines([...DEMO_LINES]);
                      setPublishIn(DEMO_WINDOWS.publishSeconds);
                      setHold(DEMO_WINDOWS.holdSeconds);
                    }
                  }}
                  className={cx("min-h-10 rounded-full px-3 text-[14px] font-bold", mode === m ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
                >
                  {m === "demo" ? "The demo creator" : "Any creator"}
                </button>
              ))}
            </div>
            {mode === "demo" ? (
              <div className="mt-4 rounded-2xl bg-canvas p-3.5 text-[14px]">
                <p className="font-semibold">
                  {DEMO_CREATOR_NAME}, the demo creator{" "}
                  <span className={cx("ml-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold", demoReady ? "bg-mint text-ink" : "bg-tomato-wash text-tomato-ink")}>
                    {demo === null ? "asking…" : demoReady ? "online" : "away"}
                  </span>
                </p>
                <p className="mt-1 text-ink-2">
                  A fictional food-and-outdoors blog run by a key this site&apos;s server holds. It accepts briefs made to it and, when you press a button on the brief&apos;s page,
                  submits one of four fixed posts. Nothing you type is ever signed by it.
                </p>
                {demo?.creator && (
                  <p className="mono mt-2 text-[12px] break-all text-ink-3">
                    {demo.creator}
                    {demo.prefix ? ` · ${demo.prefix}` : ""}
                  </p>
                )}
                {demoProblem && <p className="mt-2 font-semibold text-tomato-ink">{demoProblem}</p>}
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <label htmlFor="creator" className="label">
                    The creator&apos;s address
                  </label>
                  <input id="creator" className="field mono" placeholder="0x…" value={creator} onChange={(e) => setCreator(e.target.value)} spellCheck={false} autoComplete="off" />
                  <Suggest label="Creator suggestions" chips={[...(demo?.creator ? [{ label: "The demo creator", value: demo.creator, tag: "online" }] : []), ...CREATOR_CHIPS]} onPick={setCreator} isOn={(v) => v === creator} />
                </div>
                <div>
                  <label htmlFor="prefix" className="label">
                    The creator&apos;s site
                  </label>
                  <input id="prefix" className="field mono" placeholder="https://their-site.example/posts/" value={prefix} onChange={(e) => setPrefix(e.target.value)} spellCheck={false} autoComplete="off" />
                  <p className="mt-1 text-[12.5px] text-ink-3">The post must sit below this address: https, a lowercase host, ending in /, at most 120 characters.</p>
                  <Suggest label="Site suggestions" chips={[...(demo?.prefix ? [{ label: "Harbour Eats (demo)", value: demo.prefix }] : []), ...PREFIX_CHIPS]} onPick={setPrefix} isOn={(v) => v === prefix} />
                </div>
              </div>
            )}
          </section>

          <section className="card p-4 sm:p-5" aria-labelledby="lines">
            <h2 id="lines" className="text-[20px]">
              2. What the post must do
            </h2>
            <p className="mt-1 text-[14px] text-ink-2">One check per line, 10 to 150 characters, up to five. A line that asks for two things is met only when the post does both.</p>
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border-2 border-ink bg-canvas px-3 py-2.5">
              <span className="ad-badge mt-0.5 shrink-0">#ad</span>
              <p className="text-[14px] text-ink-2">
                <span className="font-semibold text-ink">{DISCLOSURE}</span> · line 0, added by the contract
              </p>
            </div>
            <ol className="mt-2 flex flex-col gap-2">
              {lines.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mono mt-3.5 w-5 shrink-0 text-right text-[12px] text-ink-3">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <input
                      className="field"
                      aria-label={`Line ${i + 1}`}
                      value={l}
                      maxLength={MAX_REQUIREMENT + 20}
                      placeholder="Mentions the product by name"
                      onChange={(e) => setLine(i, e.target.value)}
                    />
                    <p className="mono mt-0.5 text-right text-[11px] text-ink-3">{l.trim().length}/150</p>
                  </div>
                  <button type="button" onClick={() => removeLine(i)} className="mt-2 grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong bg-white hover:border-ink">
                    <IconX size={15} />
                    <span className="sr-only">Remove line {i + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill size="sm" variant="ghost" icon={<IconPlus size={15} />} disabled={cleanLines.length >= MAX_REQUIREMENTS} onClick={() => addLine()}>
                Add a line
              </Pill>
            </div>
            <Suggest label="Line suggestions, all three demo lines" chips={[DEMO_LINES_CHIP]} onPick={(v) => setLines([...v])} isOn={(v) => v.join("|") === cleanLines.join("|")} className="mt-3" />
            <Suggest label="Line suggestions, one line each" chips={LINE_CHIPS} onPick={(v) => addLine(v)} isOn={(v) => cleanLines.includes(v)} />
          </section>

          <section className="card p-4 sm:p-5" aria-labelledby="fee">
            <h2 id="fee" className="text-[20px]">
              3. The fee
            </h2>
            <div className="mt-3 flex items-center gap-2">
              <input id="fee-input" aria-labelledby="fee" className="field mono max-w-[200px]" inputMode="decimal" value={feeText} onChange={(e) => setFeeText(e.target.value)} />
              <span className="font-bold">GEN</span>
            </div>
            <p className="mt-1.5 text-[13px] text-ink-3">
              0.1 to 50 GEN, held by the contract.{per > 0n ? ` Each of the ${cleanLines.length} lines met earns ${gen(per)} for the creator.` : ""}
            </p>
            <Suggest label="Fee suggestions" chips={FEE_CHIPS} onPick={setFeeText} isOn={(v) => v === feeText} />
          </section>

          <section className="card p-4 sm:p-5" aria-labelledby="windows">
            <h2 id="windows" className="text-[20px]">
              4. The windows
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="publish" className="label">
                  Post up within
                </label>
                <MinutesField id="publish" seconds={publishIn} onChange={setPublishIn} />
                <p className="mt-1 text-[12.5px] text-ink-3">
                  publish_by {now > 0 ? clockTime(now + publishIn, now) : "…"}. The creator accepts before it and may submit until a day after it.
                </p>
                <Suggest label="Publish-by suggestions" chips={PUBLISH_CHIPS} onPick={setPublishIn} isOn={(v) => v === publishIn} />
              </div>
              <div>
                <label htmlFor="hold" className="label">
                  Stays up for
                </label>
                <MinutesField id="hold" seconds={hold} onChange={setHold} />
                <p className="mt-1 text-[12.5px] text-ink-3">The creator&apos;s share is held this long after the reading, then anyone may release it.</p>
                <Suggest label="Hold suggestions" chips={HOLD_CHIPS} onPick={setHold} isOn={(v) => v === hold} />
              </div>
            </div>
          </section>

          <section className="card p-4 sm:p-5" aria-labelledby="sign">
            <h2 id="sign" className="text-[20px]">
              5. Send it
            </h2>
            <div className="mt-3">
              <WalletGate need={feeAtto ?? 0n} what="to open a brief">
                <div className="flex flex-col items-start gap-3">
                  {(touched || cleanLines.length > 0) && (problem || demoProblem) && (
                    <p role="alert" className="rounded-2xl bg-tomato-wash px-3.5 py-2 text-[14px] text-tomato-ink">
                      {demoProblem || problem}
                    </p>
                  )}
                  <Pill onClick={() => void open()} disabled={busy || !!problem || !!demoProblem || now === 0}>
                    Open the brief and send {feeAtto ? gen(feeAtto) : "the fee"}
                  </Pill>
                </div>
              </WalletGate>
            </div>
            <TxStage
              className="mt-4"
              tx={tx}
              label="Opening a brief"
              sign={signGuide({ fn: "open_brief", label: `opening a brief for ${feeAtto ? gen(feeAtto) : "the fee"}`, feeAtto: (feeAtto ?? 0n).toString(), mock: isMock })}
              sending={sendingGuide({ fn: "open_brief", target: "", role: "sponsor", feeAtto: (feeAtto ?? 0n).toString(), mock: isMock })}
            />
            {refused?.kind === "refused" && (
              <p className="mt-3 rounded-2xl bg-tomato-wash px-3.5 py-2 text-[14px] text-tomato-ink">
                The contract refused the brief: {refused.reason} The {gen(refused.returnedAtto)} you sent came back in the same transaction.
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Preview">
          <BriefCard
            title="Your brief"
            lines={[DISCLOSURE, ...(cleanLines.length ? cleanLines : ["Your first line"])]}
            states={Array.from({ length: cleanLines.length + 1 }, () => "open")}
            header={<span className="mono rounded-full bg-canvas-2 px-2.5 py-0.5 text-[13px] font-semibold">{feeAtto ? gen(feeAtto) : "–"}</span>}
            footer={
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
                <dt className="text-ink-3">Creator</dt>
                <dd className="mono truncate">{creatorAddr || "–"}</dd>
                <dt className="text-ink-3">Site</dt>
                <dd className="mono break-all">{sitePrefix || "–"}</dd>
                <dt className="text-ink-3">Post up within</dt>
                <dd>{durationLabel(publishIn)}</dd>
                <dt className="text-ink-3">Stays up for</dt>
                <dd>{durationLabel(hold)}</dd>
              </dl>
            }
          />
          <div className="card p-4 text-[14px] leading-relaxed text-ink-2">
            <p className="display text-[16px] text-ink">Where your fee goes</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li>
                <strong className="text-ink">No #ad in the post:</strong> all of it comes back to you.
              </li>
              <li>
                <strong className="text-ink">Disclosed:</strong> each line met earns its share for the creator, held until the post has stayed up; the rest comes back at once.
              </li>
              <li>
                <strong className="text-ink">Nobody accepts, or no clear reading in time:</strong> all of it comes back.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function demoWhy(demo: ReturnType<typeof useDemoStatus>): string {
  if (!demo) return "Asking the site's server whether the demo creator is in…";
  if (!demo.creator) return `The demo creator is away: ${demo.reason || "the site's server holds no key"}. Pick "Any creator" to brief another address.`;
  if (!demo.prefix) return `The demo creator cannot post yet: ${demo.postsReason}.`;
  if (!demo.online) return `The demo creator is away: ${demo.reason}.`;
  return "";
}

/** A number of minutes for a window held in seconds. */
function MinutesField({ id, seconds, onChange }: { id: string; seconds: number; onChange: (s: number) => void }) {
  const [text, setText] = React.useState(String(Math.round(seconds / 60)));
  const [last, setLast] = React.useState(seconds);
  if (last !== seconds) {
    setLast(seconds);
    setText(String(Math.round(seconds / 60)));
  }
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        className="field mono max-w-[140px]"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9]/g, "");
          setText(t);
          const m = Number(t);
          if (t && Number.isFinite(m)) {
            setLast(m * 60);
            onChange(m * 60);
          }
        }}
      />
      <span className="text-[14px] font-semibold text-ink-2">minutes</span>
    </div>
  );
}
