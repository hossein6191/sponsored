// What a visitor is told whenever they wait, in five plain lines: what is happening now, how long it
// takes (or the exact time), whether they must act, whether they can leave the page, and where the money
// is. The same words for every in-between state of the site: a wallet prompt, a transaction on its way,
// the validators reading a post or rechecking it, the demo creator at work, and every state of a brief
// (waiting for the accept, waiting for the post, unclear and re-submit, a hidden ad, part met, all met,
// held until release, rechecked, released, expired, and the rest), for its sponsor, its creator and
// anyone else.
//
// Pure, with no React: the state, the viewer's role and the clock in, the words out. The waiting panel
// (components/wait-panel.tsx) renders a guide; the rows of /mine and /creator print the one-line form.
// tests/unit/guide.test.mjs runs every state for every role. Nothing here may promise what
// contracts/sponsored.py does not do.

import { clockTime, gen, span } from "./format.ts";
import { MAX_SUBMITS, SUBMIT_FEE, type BriefStatus } from "./rules.ts";
import type { Submission, WriteFn } from "./types.ts";

/** Who is looking: the brief's sponsor, its creator, or anyone else. */
export type Role = "sponsor" | "creator" | "visitor";

/** Who or what the brief waits for now, for the panel's kicker. */
export type Waiter = "you" | "creator" | "sponsor" | "validators" | "demo" | "anyone" | "nobody" | "done";

export type GuideTone = "busy" | "wait" | "late" | "ready" | "done";

export type Guide = {
  /** a stable name for the state, written on the panel for tests and tools */
  id: string;
  tone: GuideTone;
  waitsFor: Waiter;
  /** the small line above the title: who it waits for */
  kicker: string;
  /** 1. what is happening now */
  now: string;
  /** 2. how long it usually takes, or the exact time */
  time: string;
  /** 3. whether the viewer must act, and what to do */
  need: string;
  mustAct: boolean;
  /** 4. whether the viewer can close the page, and where the brief stays */
  leave: string;
  canLeave: boolean;
  /** 5. where the money is right now, with the amounts */
  money: string;
  /** one more sentence when the state needs it */
  note?: string;
  /** seconds until the next thing happens on the contract's clock, for a countdown */
  left?: number;
  leftLabel?: string;
};

export const KICKERS: Record<Waiter, string> = {
  you: "Your move",
  creator: "Waiting for the creator",
  sponsor: "Waiting for the sponsor",
  validators: "The network is reading",
  demo: "Waiting for the demo creator",
  anyone: "Open to anyone",
  nobody: "Nothing waits on you",
  done: "Closed · nothing left to do",
};

export const NOTHING_NEEDED = "Nothing is needed from you.";
export const NOTHING_LEFT = "Nothing is left to do here.";

type Lines = Omit<Guide, "kicker"> & { kicker?: string };
const make = (g: Lines): Guide => ({ ...g, kicker: g.kicker ?? KICKERS[g.waitsFor] });

const ABOUT_30 = (mock?: boolean) => (mock ? "A few seconds in this demo build; about 30 seconds on Studio." : "About 30 seconds.");
const READING_TIME = (mock?: boolean) =>
  mock
    ? "A few seconds in this demo build; 2 to 5 minutes on Studio, where every validator fetches the post itself."
    : "Usually 2 to 5 minutes: every validator fetches the post itself and asks its model four questions about it.";
const PROBE_TIME = (mock?: boolean) =>
  mock ? "A few seconds in this demo build; about a minute on Studio." : "Usually about a minute: every validator fetches the post once and asks no model.";

/** "You can close this page; B4 stays under My briefs" (no full stop). */
function keep(id: string, role: Role): string {
  if (role === "sponsor") return `You can close this page; ${id} stays under My briefs`;
  if (role === "creator") return `You can close this page; ${id} stays on your creator desk`;
  return "You can close this page and come back to this address later";
}

const whose = (role: Role, side: "sponsor" | "creator") => (role === side ? "your" : `the ${side}'s`);
const toWhom = (role: Role, side: "sponsor" | "creator") => (role === side ? "you" : `the ${side}`);

// ---- the wallet prompt --------------------------------------------------------------------------------

export type SignInput = {
  fn: WriteFn;
  /** what the call does, e.g. "Opening a brief for 0.9 GEN" */
  label: string;
  /** the brief's fee, or what is sent with the call */
  feeAtto?: string;
  /** what the brief holds now */
  heldAtto?: string;
  mock?: boolean;
};

/** Where the money is while a signature is waiting: nothing has moved yet. */
function moneyBeforeSigning(s: SignInput): string {
  const fee = gen(s.feeAtto ?? "0");
  const held = gen(s.heldAtto ?? s.feeAtto ?? "0");
  switch (s.fn) {
    case "open_brief":
      return `${fee} is still in your wallet. Once you confirm it is held by the contract, not paid to the creator; a refused brief sends all of it back in the same transaction.`;
    case "withdraw_brief":
      return `The contract holds your ${fee}; withdrawing sends all of it back to you.`;
    case "decline":
      return `The contract holds the sponsor's ${fee}; declining sends all of it back to the sponsor.`;
    case "accept":
      return `Accepting sends no GEN. The sponsor's ${fee} stays held by the contract until the post is read.`;
    case "deposit":
      return `${fee} is still in your wallet. Once you confirm it joins your own credit for submit fees, which you can withdraw at any time.`;
    case "withdraw":
      return "Your whole credit comes back to your wallet in the same transaction.";
    case "submit":
      return `No GEN leaves your wallet. A submission takes ${gen(SUBMIT_FEE)} from your credit only if the reading is unclear; the ${fee} fee stays held until the reading settles it.`;
    case "recheck":
      return `No GEN moves from your wallet. The contract holds ${held} for the creator; it goes back to the sponsor only if the post is gone.`;
    case "release":
      return `The contract holds ${held}; releasing sends all of it to the creator.`;
    case "expire":
      return `The contract holds ${fee}; expiring sends all of it back to the sponsor.`;
  }
}

/** A transaction is waiting for the visitor's signature (in mock mode: being sent, a moment). */
export function signGuide(s: SignInput): Guide {
  const money = moneyBeforeSigning(s);
  if (s.mock)
    return make({
      id: "sign",
      tone: "busy",
      waitsFor: "validators",
      kicker: "Sending",
      now: `${s.label}…`,
      time: "A moment in this demo build.",
      need: NOTHING_NEEDED,
      mustAct: false,
      leave: "Stay on this page for a moment.",
      canLeave: false,
      money,
    });
  return make({
    id: "sign",
    tone: "busy",
    waitsFor: "you",
    kicker: "Your wallet",
    now: `Your wallet is asking you to confirm: ${s.label}`,
    time: "Until you confirm or reject it in the wallet.",
    need: "Confirm it in your wallet, or reject it and nothing is sent.",
    mustAct: true,
    leave: "Stay on this page until you have answered the wallet; this page then follows the transaction for you.",
    canLeave: false,
    money,
  });
}

// ---- a plain transaction on its way ---------------------------------------------------------------------

export type SendingInput = {
  fn: Exclude<WriteFn, "submit" | "recheck">;
  /** "B4", or "" for a deposit or a withdrawal */
  target: string;
  role?: Role;
  feeAtto?: string;
  heldAtto?: string;
  mock?: boolean;
};

/** Every call the validators settle without fetching anything: sent, not final yet. */
export function sendingGuide(s: SendingInput): Guide {
  const fee = gen(s.feeAtto ?? "0");
  const held = gen(s.heldAtto ?? "0");
  const base = { tone: "busy" as const, waitsFor: "validators" as const, time: ABOUT_30(s.mock), need: NOTHING_NEEDED, mustAct: false, canLeave: true };
  const lands = (what: string) => `You can close this page; ${what} lands whether or not this page is open.`;
  switch (s.fn) {
    case "open_brief":
      return make({
        ...base,
        id: "open_brief",
        now: "Opening the brief: the validators are checking it",
        leave: "You can close this page; once it lands, the brief stays under My briefs. Stay here and its page opens by itself.",
        money: `${fee} goes from your wallet to the contract, which holds it until the post is read. A refused brief sends all of it back in the same transaction.`,
      });
    case "withdraw_brief":
      return make({ ...base, id: "withdraw_brief", now: `Withdrawing ${s.target} before the creator accepts it`, leave: lands("the withdrawal"), money: `${fee} is on its way back from the contract to your wallet.` });
    case "decline":
      return make({ ...base, id: "decline", now: `Declining ${s.target}`, leave: lands("the decline"), money: `${fee} is on its way back from the contract to the sponsor.` });
    case "accept":
      return make({ ...base, id: "accept", now: `Accepting ${s.target}: from then on the post is awaited`, leave: lands("the acceptance"), money: `The sponsor's ${fee} stays held by the contract until the post is read.` });
    case "deposit":
      return make({ ...base, id: "deposit", now: "Adding to your credit for submit fees", leave: lands("the deposit"), money: `${fee} goes from your wallet to your own credit in the contract; you can withdraw it at any time.` });
    case "withdraw":
      return make({ ...base, id: "withdraw", now: "Taking back your whole credit", leave: lands("the withdrawal"), money: "Your whole credit is on its way back to your wallet." });
    case "release":
      return make({ ...base, id: "release", now: `Releasing the held pay of ${s.target} to the creator`, leave: lands("the release"), money: `${held} is on its way from the contract to the creator.` });
    case "expire":
      return make({ ...base, id: "expire", now: `Expiring ${s.target}: its window closed with no clear reading`, leave: lands("the expiry"), money: `${fee} is on its way from the contract back to the sponsor.` });
  }
}

/** A final transaction whose effect is not on screen yet: a few seconds. */
export function updatingGuide(what: string): Guide {
  return make({
    id: "updating",
    tone: "busy",
    waitsFor: "nobody",
    kicker: "Final",
    now: what,
    time: "A few seconds.",
    need: NOTHING_NEEDED,
    mustAct: false,
    leave: "You can close this page; the transaction is final. Stay a few seconds to see it here.",
    canLeave: true,
    money: "The transaction is final; this page shows where the money is in a moment.",
  });
}

// ---- a post being read, and a post being rechecked ------------------------------------------------------

export type ReadInput = {
  role: Role;
  brief: string;
  /** what the page calls the post, e.g. "no-link.html" */
  page: string;
  feeAtto: string;
  holdSeconds: number;
  stage: "busy" | "late";
  mock?: boolean;
};

/** A submission: every validator fetches the post on the live web and asks four questions about it. */
export function readingGuide(r: ReadInput): Guide {
  const late = r.stage === "late";
  return make({
    id: late ? "reading-late" : "reading",
    tone: late ? "late" : "busy",
    waitsFor: "validators",
    now: late ? `The validators are still reading ${r.page}` : `The validators are opening ${r.page} on the live web and reading it line by line, the #ad line first`,
    time: late
      ? "Over 6 minutes so far. Studio is slow at times; the reading still lands here by itself. A post that cannot be read stores nothing and takes no fee, and it may be submitted again."
      : READING_TIME(r.mock),
    need: NOTHING_NEEDED,
    mustAct: false,
    leave: `${keep(r.brief, r.role)}; the reading lands whether or not this page is open.`,
    canLeave: true,
    money: `The contract holds ${gen(r.feeAtto)}. If the post has no #ad, all of it goes back to the sponsor; otherwise each line met holds its share for the creator for ${span(r.holdSeconds)}, and the rest goes back at once.`,
  });
}

export type RecheckInput = { role: Role; brief: string; heldAtto: string; stage: "busy" | "late"; mock?: boolean };

/** A recheck: every validator fetches the same post again and reads only its status. */
export function recheckGuide(r: RecheckInput): Guide {
  const late = r.stage === "late";
  return make({
    id: late ? "rechecking-late" : "rechecking",
    tone: late ? "late" : "busy",
    waitsFor: "validators",
    now: late ? "The validators are still fetching the post" : "The validators are fetching the post again: is it still up?",
    time: late ? "Over 4 minutes so far. A fetch that fails, or a status other than 2xx, 404 or 410, stores nothing; it may be asked again." : PROBE_TIME(r.mock),
    need: NOTHING_NEEDED,
    mustAct: false,
    leave: `${keep(r.brief, r.role)}; the answer lands whether or not this page is open.`,
    canLeave: true,
    money: `The contract holds ${gen(r.heldAtto)} for the creator. A 404 or 410 sends it back to the sponsor; a post still up changes nothing.`,
  });
}

// ---- the demo creator at work -------------------------------------------------------------------------

export type DemoInput = { state: "asking" | "failed"; what: string; brief: string; feeAtto: string; reason?: string; mock?: boolean };

/** The visitor asked the demo creator to do something: it signs with its own key, one fixed move. */
export function demoGuide(d: DemoInput): Guide {
  if (d.state === "failed")
    return make({
      id: "demo-failed",
      tone: "late",
      waitsFor: "demo",
      now: "The demo creator did not act",
      time: "Try again in a minute.",
      need: "Press the button again, or wait a minute first.",
      mustAct: false,
      leave: "You can close this page; nothing was sent from your wallet.",
      canLeave: true,
      money: `Your wallet is untouched. The ${gen(d.feeAtto)} fee stays held by the contract.`,
      note: d.reason,
    });
  return make({
    id: "demo-asking",
    tone: "busy",
    waitsFor: "demo",
    now: `The demo creator is signing: ${d.what}`,
    time: ABOUT_30(d.mock) + " Then the network takes its usual time.",
    need: NOTHING_NEEDED,
    mustAct: false,
    leave: "Stay a few seconds while the demo creator sends it; then this page follows the transaction for you.",
    canLeave: false,
    money: `Your wallet is untouched: the demo creator signs with its own key. The ${gen(d.feeAtto)} fee stays held by the contract.`,
  });
}

// ---- one brief, in every state -------------------------------------------------------------------------

export type BriefInput = {
  role: Role;
  /** the contract's clock, seconds */
  now: number;
  id: string;
  status: BriefStatus;
  feeAtto: string;
  heldAtto: string;
  toCreatorAtto: string;
  toSponsorAtto: string;
  feesToSponsorAtto: string;
  publishBy: number;
  submitCloses: number;
  holdSeconds: number;
  holdUntil: number;
  closedAt: number;
  tries: number;
  submissions: Submission[];
  met: number;
  of: number;
  rechecks: number;
  recheckedAt: number;
  up: string;
  /** a brief to the demo creator, who acts when its buttons are pressed */
  demo?: boolean;
  mock?: boolean;
};

/** Every state a brief can be in, as briefState names it. */
export const BRIEF_STATES = [
  "offered",
  "offered-missed",
  "accepted",
  "unclear",
  "accepted-spent",
  "expirable",
  "held-all",
  "held-part",
  "rechecked",
  "releasable",
  "released",
  "hidden_ad",
  "nothing_met",
  "taken_down",
  "expired",
  "declined",
  "withdrawn",
] as const;
export type BriefState = (typeof BRIEF_STATES)[number];

/** Which of the states a brief is in at `now`. */
export function briefState(b: Pick<BriefInput, "status" | "now" | "publishBy" | "submitCloses" | "tries" | "submissions" | "met" | "of" | "rechecks" | "up" | "holdUntil">): BriefState {
  switch (b.status) {
    case "offered":
      if (b.now >= b.submitCloses) return "expirable";
      return b.now < b.publishBy ? "offered" : "offered-missed";
    case "accepted": {
      if (b.now >= b.submitCloses) return "expirable";
      if (b.tries >= MAX_SUBMITS) return "accepted-spent";
      return b.tries > 0 ? "unclear" : "accepted";
    }
    case "held":
      if (b.now >= b.holdUntil) return "releasable";
      if (b.rechecks > 0 && b.up === "yes") return "rechecked";
      return b.met >= b.of ? "held-all" : "held-part";
    default:
      return b.status;
  }
}

/** Every state of one brief, for its sponsor, its creator or anyone else. */
export function briefGuide(g: BriefInput): Guide {
  const state = briefState(g);
  const { role, id, now } = g;
  const fee = gen(g.feeAtto);
  const held = gen(g.heldAtto);
  const at = (t: number) => clockTime(t, now);
  const leaveOpen = { leave: `${keep(id, role)}.`, canLeave: true };
  const closed = (what: string) => ({
    tone: "done" as const,
    waitsFor: "done" as const,
    time: g.closedAt ? `Closed at ${at(g.closedAt)}. ${what}` : what,
    need: NOTHING_LEFT,
    mustAct: false,
    leave: "You can close this page; nothing more will happen to this brief.",
    canLeave: true,
  });
  const back = gen(g.toSponsorAtto);
  const paid = gen(g.toCreatorAtto);
  switch (state) {
    case "offered":
      return make({
        id: state,
        tone: role === "creator" ? "ready" : "wait",
        waitsFor: role === "creator" ? "you" : g.demo ? "demo" : "creator",
        now:
          role === "creator"
            ? `${id} is offered to you: accept it to take it on, or decline it`
            : g.demo
              ? `${id} is waiting for the demo creator to accept it`
              : `${id} is waiting for its creator to accept it`,
        time: `The creator can accept until ${at(g.publishBy)}, ${span(g.publishBy - now)} from now.`,
        need:
          role === "creator"
            ? "Accept it before publish_by, or decline it: either is one signature."
            : role === "sponsor"
              ? g.demo
                ? "Ask the demo creator to accept it, below. You may also withdraw it while it is not accepted, and have the whole fee back."
                : "Nothing is needed from you. You may withdraw it while it is not accepted, and have the whole fee back."
              : NOTHING_NEEDED,
        mustAct: role === "creator" || (role === "sponsor" && !!g.demo),
        ...leaveOpen,
        money: `The contract holds ${whose(role, "sponsor")} ${fee} in escrow. A withdrawal or a decline sends all of it back to the sponsor; nothing goes to the creator before a post is read.`,
        left: g.publishBy - now,
        leftLabel: "left to accept",
      });
    case "offered-missed":
      return make({
        id: state,
        tone: "late",
        waitsFor: role === "sponsor" ? "you" : "sponsor",
        now: `Nobody accepted ${id} before its publish_by`,
        time: `Anyone may expire it from ${at(g.submitCloses)}, ${span(g.submitCloses - now)} from now.`,
        need:
          role === "sponsor"
            ? "Withdraw it now to have the whole fee back, or wait and anyone may expire it."
            : role === "creator"
              ? "It can no longer be accepted. You may decline it, which sends the fee back to the sponsor."
              : NOTHING_NEEDED,
        mustAct: false,
        ...leaveOpen,
        money: `The contract still holds ${whose(role, "sponsor")} ${fee}; a withdrawal, a decline or an expiry sends all of it back to the sponsor.`,
        left: g.submitCloses - now,
        leftLabel: "until anyone may expire",
      });
    case "accepted": {
      const beforeDeadline = now < g.publishBy;
      return make({
        id: state,
        tone: role === "creator" ? "ready" : "wait",
        waitsFor: role === "creator" ? "you" : g.demo ? "demo" : "creator",
        now:
          role === "creator"
            ? `You accepted ${id}: publish the post on your site and submit its address`
            : g.demo
              ? `The demo creator accepted ${id}; choose what it posts, below`
              : `The creator accepted ${id}; the post is awaited`,
        time: beforeDeadline
          ? `The post should be up by ${at(g.publishBy)}; it can be submitted until ${at(g.submitCloses)}, a day later.`
          : `Publish_by has passed; the post can still be submitted until ${at(g.submitCloses)}, ${span(g.submitCloses - now)} from now.`,
        need:
          role === "creator"
            ? `Submit the post's address. A submission needs ${gen(SUBMIT_FEE)} of credit, deposited beforehand, and keeps it unless the reading is unclear.`
            : role === "sponsor" && g.demo
              ? "Pick what the demo creator posts, below: each button is one fixed post, with the outcome the network should reach."
              : NOTHING_NEEDED,
        mustAct: role === "creator" || (role === "sponsor" && !!g.demo),
        ...leaveOpen,
        money: `The contract holds ${fee}. Once the post is read, the creator's share for the lines met is held until the post has stayed up ${span(g.holdSeconds)}, and the rest goes back to the sponsor at once; a post with no #ad sends all of it back.`,
        left: (beforeDeadline ? g.publishBy : g.submitCloses) - now,
        leftLabel: beforeDeadline ? "to publish by" : "left to submit",
      });
    }
    case "unclear":
      return make({
        id: state,
        tone: role === "creator" ? "ready" : "late",
        waitsFor: role === "creator" ? "you" : g.demo ? "demo" : "creator",
        now: `The network read the post for ${id} but could not agree on a clear answer: unclear`,
        time: `One more submission is allowed, until ${at(g.submitCloses)}, ${span(g.submitCloses - now)} from now.`,
        need:
          role === "creator"
            ? "Submit again, the same post or a clearer one: one more try is all there is."
            : role === "sponsor" && g.demo
              ? "Ask the demo creator to post again, below."
              : NOTHING_NEEDED,
        mustAct: role === "creator" || (role === "sponsor" && !!g.demo),
        ...leaveOpen,
        money: `Nothing moved from the escrow: the contract still holds ${fee}. The ${gen(SUBMIT_FEE)} submit fee went from the creator's credit to the sponsor.`,
        left: g.submitCloses - now,
        leftLabel: "left to re-submit",
      });
    case "accepted-spent":
      return make({
        id: state,
        tone: "late",
        waitsFor: "anyone",
        now: `${id} had its submission and its one re-submission, and neither read clearly`,
        time: `Anyone may expire it from ${at(g.submitCloses)}, ${span(g.submitCloses - now)} from now.`,
        need: "Nothing can be done until then; then anyone may expire it, and the fee goes back to the sponsor.",
        mustAct: false,
        ...leaveOpen,
        money: `The contract still holds ${fee}. Each unclear reading moved ${gen(SUBMIT_FEE)} from the creator's credit to the sponsor (${gen(g.feesToSponsorAtto)} so far).`,
        left: g.submitCloses - now,
        leftLabel: "until anyone may expire",
      });
    case "expirable":
      return make({
        id: state,
        tone: "ready",
        waitsFor: role === "sponsor" ? "you" : "anyone",
        now: `${id}'s window has closed with no clear reading`,
        time: "Now: one transaction, and anyone may send it.",
        need: role === "sponsor" ? "Expire it to have the whole fee back; anyone may press it, you included." : "Anyone may expire it, you included; the fee can only go back to the sponsor.",
        mustAct: role === "sponsor",
        ...leaveOpen,
        money: `The contract still holds ${fee}; expiring sends all of it back to the sponsor.`,
      });
    case "held-all":
    case "held-part":
    case "rechecked": {
      const all = g.met >= g.of;
      const what = all ? "Every line met" : `${g.met} of ${g.of} lines met`;
      const backLine = g.toSponsorAtto === "0" ? "Nothing went back: every line was met." : `${back} went back to the sponsor at once.`;
      return make({
        id: state,
        tone: "wait",
        waitsFor: role === "creator" ? "nobody" : "anyone",
        kicker: "Held until release",
        now:
          state === "rechecked"
            ? `A recheck at ${at(g.recheckedAt)} found the post still up; ${whose(role, "creator")} ${held} stays held`
            : `${what}: ${whose(role, "creator")} ${held} is held until the post has stayed up ${span(g.holdSeconds)}`,
        time: `Released from ${at(g.holdUntil)}, ${span(g.holdUntil - now)} from now.`,
        need:
          role === "creator"
            ? "Keep the post up. Nothing else is needed; anyone may release the pay once the hold ends."
            : role === "sponsor"
              ? "Nothing is needed. While the pay is held anyone may recheck that the post is still up; a post taken down sends the held part back to you."
              : "Nothing is needed. Anyone may recheck that the post is still up while the pay is held.",
        mustAct: false,
        ...leaveOpen,
        money: `The contract holds ${held} for the creator. ${backLine}`,
        left: g.holdUntil - now,
        leftLabel: "until release",
      });
    }
    case "releasable":
      return make({
        id: state,
        tone: "ready",
        waitsFor: role === "creator" ? "you" : "anyone",
        now: `The hold of ${id} has ended: the held pay can be released`,
        time: "Now: one transaction, and anyone may send it.",
        need: role === "creator" ? "Release it to be paid; anyone may press it, you included." : "Anyone may release it, you included; the pay can only go to the creator.",
        mustAct: role === "creator",
        ...leaveOpen,
        money: `The contract holds ${held}; releasing sends all of it to ${toWhom(role, "creator")}.`,
      });
    case "released":
      return make({
        id: state,
        ...closed("The post stayed up for the whole hold."),
        now: `${role === "creator" ? "You were" : "The creator was"} paid for ${id}`,
        money: `${paid} went to the creator and ${back} back to the sponsor. The contract holds nothing for this brief.`,
      });
    case "hidden_ad":
      return make({
        id: state,
        ...closed("A post that hides that it is an ad is not paid."),
        now: "The post did not say it was sponsored: a hidden ad, not paid",
        money: `The whole ${fee} went back to the sponsor; nothing to the creator.`,
      });
    case "nothing_met":
      return make({
        id: state,
        ...closed("A disclosed post that meets none of the lines is owed nothing."),
        now: "The post said it was sponsored, but met none of the sponsor's lines",
        money: `The whole ${fee} went back to the sponsor; nothing to the creator.`,
      });
    case "taken_down":
      return make({
        id: state,
        ...closed("A post must stay up for the whole hold to be paid."),
        now: "A recheck found the post gone while its pay was held",
        money: `The held part went back to the sponsor: ${back} in all went back, and nothing to the creator.`,
      });
    case "expired":
      return make({
        id: state,
        ...closed("No clear reading was made in time."),
        now: `${id} expired with no clear reading`,
        money: `The whole ${fee} went back to the sponsor.${g.feesToSponsorAtto !== "0" ? ` The sponsor also had ${gen(g.feesToSponsorAtto)} of submit fees from unclear readings.` : ""}`,
      });
    case "declined":
      return make({
        id: state,
        ...closed("The creator turned the brief down."),
        now: `${role === "creator" ? "You" : "The creator"} declined ${id}`,
        money: `The whole ${fee} went back to the sponsor.`,
      });
    case "withdrawn":
      return make({
        id: state,
        ...closed("It was taken back before the creator accepted it."),
        now: `${role === "sponsor" ? "You" : "The sponsor"} withdrew ${id}`,
        money: `The whole ${fee} went back to the sponsor.`,
      });
  }
}

/** The one-line form for lists: who it waits for, then what is happening. */
export function briefLine(g: BriefInput): string {
  const guide = briefGuide(g);
  return `${guide.kicker}: ${guide.now}.`;
}

/** A brief as read from the chain, seen by `role` at `now`, as the guide's input. */
export function briefInputOf(
  b: Pick<BriefInput, "id" | "status" | "feeAtto" | "heldAtto" | "toCreatorAtto" | "toSponsorAtto" | "feesToSponsorAtto" | "publishBy" | "submitCloses" | "holdSeconds" | "holdUntil" | "closedAt" | "tries" | "submissions" | "met" | "of" | "rechecks" | "recheckedAt" | "up">,
  role: Role,
  now: number,
  opts: { demo?: boolean; mock?: boolean } = {},
): BriefInput {
  return {
    role,
    now,
    id: b.id,
    status: b.status,
    feeAtto: b.feeAtto,
    heldAtto: b.heldAtto,
    toCreatorAtto: b.toCreatorAtto,
    toSponsorAtto: b.toSponsorAtto,
    feesToSponsorAtto: b.feesToSponsorAtto,
    publishBy: b.publishBy,
    submitCloses: b.submitCloses,
    holdSeconds: b.holdSeconds,
    holdUntil: b.holdUntil,
    closedAt: b.closedAt,
    tries: b.tries,
    submissions: b.submissions,
    met: b.met,
    of: b.of,
    rechecks: b.rechecks,
    recheckedAt: b.recheckedAt,
    up: b.up,
    demo: opts.demo,
    mock: opts.mock,
  };
}
