// The home page: the promise in one minute, how the money moves on each kind of post, and where to start.

import { BriefCard, MaskChips } from "@/components/brief-card";
import { PillLink } from "@/components/button";
import { IconEye, IconHand, IconPlus, IconSpark } from "@/components/icons";
import { DemoPostCard, PhoneFrame } from "@/components/phone-post";
import { contractInUse, isMock } from "@/lib/chain";
import { DEMO_LINES, DEMO_POSTS, OUTCOME_WORDS, postOf, splitOf } from "@/lib/demo-creator";
import { gen } from "@/lib/format";
import { DISCLOSURE } from "@/lib/rules";
import { cx } from "@/lib/cx";

const FEE = (9n * 10n ** 18n) / 10n;

const STEPS = [
  {
    n: "1",
    title: "The sponsor opens a brief",
    text: "One creator, their site, one to five lines in plain words, a publish-by time and how long the post must stay up. The fee goes in with it and the contract holds it.",
  },
  {
    n: "2",
    title: "The contract adds line 0",
    text: `Every brief starts with the same line, word for word: "${DISCLOSURE}". A post that hides that it is an ad is not paid.`,
  },
  {
    n: "3",
    title: "The creator posts and submits",
    text: "The creator accepts, publishes on their own site and submits the address. Every validator fetches the post itself and reads it against every line, in two framings and two numberings.",
  },
  {
    n: "4",
    title: "The money moves at once",
    text: "Line 0 unmet: the whole fee back. Otherwise each line met earns its share, held until the post has stayed up; the rest goes back to the sponsor straight away.",
  },
];

export default function Home() {
  const contract = contractInUse();
  const hero = postOf("no-link");
  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div>
          <p className="kicker inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-ink-2 ring-1 ring-line">
            <IconSpark size={14} className="text-tomato" /> A GenLayer Intelligent Contract
          </p>
          <h1 className="mt-4 text-[44px] sm:text-[64px]">
            Paid for what the post <span className="text-tomato">actually</span> shows.
          </h1>
          <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-ink-2">
            A sponsor sends the fee with a short brief. The creator posts. Every validator reads the post on the live web, line by line: a post that hides that it is an ad
            is not paid, and each line met pays its share of the fee.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PillLink href="/brief/new?demo=1">Try it with the demo creator</PillLink>
            <PillLink href="/how" variant="ghost">
              How it works
            </PillLink>
          </div>
          <p className="mt-5 text-[13.5px] text-ink-3">
            {isMock
              ? "Demo build: an in-memory copy of the contract, no wallet needed."
              : contract
                ? `Live on GenLayer Studio, contract ${contract.slice(0, 10)}…`
                : "The contract is not deployed yet; the demo build shows every page."}
          </p>
        </div>
        <div className="relative flex flex-col items-center gap-5 lg:block">
          <PhoneFrame label="A demo post in a phone frame" className="lg:mr-auto lg:ml-6">
            <DemoPostCard post={hero} time="2 h" />
          </PhoneFrame>
          <div className="card w-full max-w-[340px] p-3.5 lg:absolute lg:right-0 lg:bottom-10 lg:w-[300px] lg:rotate-[2deg]">
            <p className="kicker text-ink-3">The network agreed</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13.5px]">
              {[DISCLOSURE, ...DEMO_LINES].map((line, i) => {
                const met = hero.mask[i] === "1";
                return (
                  <li key={i} className={cx("flex items-start gap-2 rounded-xl px-2.5 py-1.5", met ? "bg-mint-wash" : "bg-tomato-wash")}>
                    <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-ink text-[11px] font-black", met ? "bg-mint" : "bg-tomato text-white")}>
                      {met ? "✓" : "×"}
                    </span>
                    <span className="min-w-0">{i === 0 ? <span className="ad-badge">#ad</span> : line}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2.5 text-[13px] text-ink-2">
              No link: <span className="mono font-semibold">0.6 GEN</span> held for the creator, <span className="mono font-semibold">0.3 GEN</span> back at once.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="minute">
        <p className="kicker text-tomato-ink">The promise in one minute</p>
        <h2 id="minute" className="mt-1.5 text-[32px] sm:text-[40px]">
          A brief, a post, a reading, a payout.
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="card p-5">
              <span className="display grid size-10 place-items-center rounded-full bg-ink text-[17px] text-white">{s.n}</span>
              <h3 className="mt-3 text-[19px]">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="money">
        <p className="kicker text-tomato-ink">How the money moves</p>
        <h2 id="money" className="mt-1.5 text-[32px] sm:text-[40px]">
          One brief of {gen(FEE)}, four posts.
        </h2>
        <p className="mt-3 max-w-[720px] text-[16px] leading-relaxed text-ink-2">
          The demo brief asks for three things of a post about the fictional Tidewell 20 L dry bag, 0.3 GEN each. The fictional blog Harbour Eats has four versions of the
          post. Here is what each one earns, as the contract works it out.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {DEMO_POSTS.map((p) => {
            const { owed, back } = splitOf(FEE, p.mask);
            const pct = Number((owed * 100n) / FEE);
            return (
              <article key={p.key} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[19px]">{p.label}</h3>
                  <MaskChips mask={p.mask} />
                </div>
                <p className="mt-1.5 text-[14.5px] text-ink-2">The post {p.says}.</p>
                <div className="mt-4 flex h-9 overflow-hidden rounded-full border-2 border-ink" aria-hidden="true">
                  {pct > 0 && (
                    <span className="flex items-center bg-mint px-3 text-[12.5px] font-bold whitespace-nowrap" style={{ width: `${pct}%` }}>
                      creator
                    </span>
                  )}
                  {pct < 100 && <span className="flex flex-1 items-center bg-tomato-wash px-3 text-[12.5px] font-bold whitespace-nowrap text-tomato-ink">back to sponsor</span>}
                </div>
                <p className="mt-3 text-[14px] text-ink-2">
                  <strong className="text-ink">{OUTCOME_WORDS[p.outcome]}.</strong> <span className="mono">{gen(owed)}</span> to the creator
                  {owed > 0n ? " once the hold ends" : ""}, <span className="mono">{gen(back)}</span> back to the sponsor{owed > 0n && back > 0n ? " at once" : ""}.
                </p>
              </article>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] border-2 border-dashed border-line-strong p-5">
            <h3 className="text-[17px]">Unclear</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              When the two framings or the two numberings disagree, nothing moves from the escrow; the creator&apos;s 0.01 GEN submit fee goes to the sponsor and the creator may
              submit once more.
            </p>
          </div>
          <div className="rounded-[22px] border-2 border-dashed border-line-strong p-5">
            <h3 className="text-[17px]">Taken down while held</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              While pay is held, anyone may recheck the post. A 404 or 410, agreed by every validator, sends the held part back to the sponsor. After the hold, anyone may
              release it to the creator.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="start" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="kicker text-tomato-ink">Start</p>
          <h2 id="start" className="mt-1.5 text-[32px] sm:text-[40px]">
            Play the sponsor with one wallet.
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
            The demo creator writes Harbour Eats. Open a brief to it with the demo lines and short windows, and it accepts. Then pick what it posts: the full post, the same
            post with no #ad, one without the link, or one about the wrong bag. Watch the validators read it and the money move.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PillLink href="/brief/new?demo=1" icon={<IconPlus size={18} />}>
              Open a demo brief
            </PillLink>
            <PillLink href="/creator" variant="ink" icon={<IconHand size={18} />}>
              I am a creator
            </PillLink>
            <PillLink href="/ledger" variant="ghost" icon={<IconEye size={18} />}>
              Just looking
            </PillLink>
          </div>
        </div>
        <BriefCard
          title="The demo brief"
          lines={[DISCLOSURE, ...DEMO_LINES]}
          states={["expected-met", "expected-met", "expected-met", "expected-met"]}
          header={<span className="mono rounded-full bg-canvas-2 px-2.5 py-0.5 text-[13px] font-semibold">0.9 GEN</span>}
          footer={<p className="text-[13px] text-ink-3">Publish within 30 minutes; keep the post up 10 minutes; then it is paid.</p>}
        />
      </section>
    </div>
  );
}
