// How it works: the questions every validator asks, word for word; why this needs GenLayer; where the
// money goes; the limits, stated plainly; and the contract's own rules() read live.

import { PageHead } from "@/components/bits";
import { LiveRules } from "@/components/live-rules";
import { DISCLOSURE, QUESTION_MET, QUESTION_UNMET, READING, RETURN_LIST } from "@/lib/rules";

const ASKINGS = [
  { n: 1, order: "as listed, 0 to n", q: "MET", text: QUESTION_MET },
  { n: 2, order: "reversed, every line relabelled 0 to n", q: "MET", text: QUESTION_MET },
  { n: 3, order: "as listed", q: "UNMET", text: QUESTION_UNMET },
  { n: 4, order: "reversed, relabelled", q: "UNMET", text: QUESTION_UNMET },
];

const MONEY: [string, string, string][] = [
  ["open_brief", "", "pays the fee into escrow (0.1 to 50 GEN)"],
  ["withdraw_brief, decline", "", "the whole fee"],
  ["submit: line 0 unmet, a hidden ad", "nothing", "the whole fee"],
  ["submit: m of n sponsor lines met", "fee × m ÷ n, held", "the rest, at once"],
  ["submit: disclosed, no sponsor line met", "nothing", "the whole fee"],
  ["submit: unclear", "", "the 0.01 GEN submit fee, from the creator's credit"],
  ["recheck: the post is gone (404 or 410)", "nothing", "the held part"],
  ["recheck: still up", "", ""],
  ["release, after the hold", "the held part", ""],
  ["expire, a day after publish_by", "", "the whole fee"],
  ["a refused open_brief or deposit", "", "everything sent comes back in the same transaction"],
];

const LIMITS = [
  ["The page must read the same for every validator.", "A page that changes from one fetch to the next, or by who asks, gets no consensus and stores nothing."],
  ["Text is read, not images, video or styling.", "A disclosure only in a picture does not count. A link counts only when its address is written out in the text. Words hidden with CSS still read as written."],
  ["The creator controls the page.", "A recheck reads only the status: a post edited while its pay is held still counts as up, and a post edited or removed after its pay is released is not caught. A host that answers 404 during an outage while the pay is held costs the creator that pay."],
  ["One check per line.", "A line that asks for two things is met only when the post does both, and honest readers may split on it. The contract cannot count the asks in a sentence, so this is a rule the sponsor is told."],
  ["Publication time is not proven.", "The contract knows when the post was submitted and read, not when it first went up."],
  ["The model can be wrong.", "Two framings in two numberings catch a model that is inconsistent; they do not catch one that is consistently wrong."],
];

export default function HowPage() {
  return (
    <div className="flex flex-col gap-12">
      <PageHead kicker="How it works" title="The brief, the reading, the money.">
        A sponsor pays a creator for a post. The contract holds the fee, every validator reads the post on the live web against the brief, and the money moves on what they agree
        the post says.
      </PageHead>

      <section aria-labelledby="questions" className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="kicker text-tomato-ink">The questions, word for word</p>
          <h2 id="questions" className="mt-1.5 text-[30px]">
            Four askings over one page.
          </h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
            Every validator fetches the post itself, removes the tags, keeps at most 6,000 characters and fingerprints them. Then it asks its model four questions over two
            fenced blocks: the numbered requirements, line 0 first, and the page. Line 0 is always the contract&apos;s own:
          </p>
          <p className="mt-3 rounded-2xl border-2 border-ink bg-white p-3.5 text-[15px] font-semibold">
            <span className="ad-badge mr-2">#ad</span>
            {DISCLOSURE}
          </p>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
            Reversed, every line is relabelled, the disclosure included, so a model that trusts whatever comes first splits its own answers. A mask is stored only when both
            MET answers agree, both UNMET answers agree, and every line is in exactly one of the two lists; anything else is unclear. The whole value is compared by exact
            equality, so a page that reads differently for two validators stores nothing.
          </p>
        </div>
        <ol className="flex flex-col gap-2.5">
          {ASKINGS.map((a) => (
            <li key={a.n} className="card p-4">
              <p className="flex flex-wrap items-center gap-2">
                <span className="display grid size-8 place-items-center rounded-full bg-ink text-[14px] text-white">{a.n}</span>
                <span className={a.q === "MET" ? "rounded-full bg-mint px-2.5 py-0.5 text-[12px] font-bold" : "rounded-full bg-tomato px-2.5 py-0.5 text-[12px] font-bold text-white"}>{a.q}</span>
                <span className="text-[13px] text-ink-3">requirements {a.order}</span>
              </p>
              <blockquote className="mt-2 text-[15px] leading-relaxed">{a.text}</blockquote>
            </li>
          ))}
          <li className="rounded-[22px] bg-ink p-4 text-[14px] leading-relaxed text-white/85">
            <p>{READING}</p>
            <p className="mt-2 text-white/70">{RETURN_LIST}</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="why" className="card p-5 sm:p-7">
        <p className="kicker text-tomato-ink">Why GenLayer</p>
        <h2 id="why" className="mt-1.5 text-[28px]">
          The evidence is a page on somebody else&apos;s server.
        </h2>
        <div className="mt-3 grid gap-4 text-[15.5px] leading-relaxed text-ink-2 md:grid-cols-2">
          <p>
            No oracle publishes &quot;does this blog post say it is sponsored&quot;. A contract on a plain chain cannot fetch the post, and a single server that fetched it for the
            contract would be the one party both sides have to trust.
          </p>
          <p>
            Here every validator fetches the page itself, at the moment of the transaction, and reads it in words; the agreement is on what the page says, not on what someone
            reported it says. Whether the post is still up during the hold is read from the live web, by every validator, again.
          </p>
        </div>
      </section>

      <section aria-labelledby="money">
        <p className="kicker text-tomato-ink">The money</p>
        <h2 id="money" className="mt-1.5 text-[30px]">
          Where every GEN goes.
        </h2>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] tracking-[0.08em] text-ink-3 uppercase">
                <th className="px-4 py-3 font-bold">Event</th>
                <th className="px-4 py-3 font-bold">To the creator</th>
                <th className="px-4 py-3 font-bold">To the sponsor</th>
              </tr>
            </thead>
            <tbody>
              {MONEY.map(([e, c, s]) => (
                <tr key={e} className="border-b border-line last:border-0">
                  <td className="mono px-4 py-2.5 text-[13px]">{e}</td>
                  <td className="px-4 py-2.5 text-mint-ink">{c}</td>
                  <td className="px-4 py-2.5 text-tomato-ink">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] text-ink-3">
          A clear reading leaves the 0.01 GEN submit fee in the creator&apos;s credit, which the creator can withdraw at any time. The contract holds exactly the escrow of
          offered, accepted and held briefs plus every credit.
        </p>
      </section>

      <section aria-labelledby="limits">
        <p className="kicker text-tomato-ink">The limits, stated plainly</p>
        <h2 id="limits" className="mt-1.5 text-[30px]">
          What it does not do.
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {LIMITS.map(([t, d]) => (
            <li key={t} className="card p-4">
              <p className="display text-[17px]">{t}</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rules" className="card p-5 sm:p-7">
        <p className="kicker text-tomato-ink">rules(), read live</p>
        <h2 id="rules" className="mt-1.5 mb-4 text-[28px]">
          The contract&apos;s own words.
        </h2>
        <LiveRules />
      </section>
    </div>
  );
}
