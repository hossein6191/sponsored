// A stand-in for the contract, in memory, for NEXT_PUBLIC_MOCK=1. lib/chain.ts delegates here.
//
// It follows contracts/sponsored.py on everything deterministic: who may call what and when, the order
// of the checks and their refusal sentences word for word, the windows (accept before publish_by, submit
// until a day after it, recheck while held, release from the end of the hold, expire a day after
// publish_by), the split of the fee on a mask, where every atto goes, the counters, and every view
// answered in the contract's own JSON shape, so the mappers in lib/chain.ts run on the same rows in both
// modes. The one thing it cannot do is fetch a page or ask a model: a submitted post is read as
// SCRIPTED from the four demo posts (lib/demo-creator.ts), whose answers for the disclosure and the three
// demo lines are known; a brief with any other line reads as unclear here, and any other address cannot
// be fetched and stores nothing. A recheck finds a demo post up, unless the demo bar took it down. The
// demo bar says all of this on every page.
//
// The visitor acts as one of a few demo accounts. The demo creator writes Harbour Eats and acts when its
// buttons are pressed (demoAccept and demoPost, the in-memory twins of POST /api/demo/accept and
// /api/demo/post). A few briefs are seeded so the ledger has something to show, and the clock can be
// moved on so a hold can be seen ending. State lasts as long as the tab.

import type { Call, DemoAnswer, DemoStatus, TxStatus, WriteFn } from "./types.ts";
import { notify } from "./browser-store.ts";
import { REPO_URL } from "./config.ts";
import { DEMO_LINES, DEMO_WINDOWS, demoProblem, postOf, postOfUrl, postsBase, repoOf, scriptedReading, type PostKey } from "./demo-creator.ts";
import {
  ADDRESS_CHARS,
  DISCLOSURE,
  FP_CHARS,
  GONE_STATUSES,
  ID_CHARS,
  MAX_FEE,
  MAX_HOLD,
  MAX_LEAD,
  MAX_PAGE_TEXT,
  MAX_PREFIX,
  MAX_RAW_PAGE,
  MAX_REQUIREMENT,
  MAX_REQUIREMENTS,
  MAX_REQUIREMENTS_JSON,
  MAX_SUBMITS,
  MAX_URL,
  MIN_FEE,
  MIN_HOLD,
  MIN_LEAD,
  MIN_REQUIREMENT,
  MIN_REQUIREMENTS,
  PAGE,
  QUESTION_MET,
  QUESTION_UNMET,
  READING,
  RETURN_LIST,
  SUBMIT_FEE,
  SUBMIT_GRACE,
  UNCLEAR,
  UP_GONE,
  UP_YES,
  numberArg,
  openProblem,
  pyStrip,
  requirementsOf,
  under,
  urlProblem,
  type BriefStatus,
} from "./rules.ts";

const GEN = 10n ** 18n;
export const MOCK_CONTRACT = "0x0000000000000000000000000000000000ad5c0e";
/** The commit the demo build pretends its posts are pinned to. */
export const MOCK_COMMIT = "0123456789abcdef0123456789abcdef01234567";
export const MOCK_REPO = repoOf(REPO_URL) || "demo-owner/sponsored";
/** The demo creator's site in the demo build. */
export const MOCK_PREFIX = postsBase(MOCK_REPO, MOCK_COMMIT);
/** The address of a demo post under the demo build's pretend commit. */
export const mockPost = (key: PostKey): string => MOCK_PREFIX + postOf(key).file;
/** The "You, a creator" persona's own site: the demo build reads the four demo posts wherever they sit. */
export const MY_SITE = "https://moss-and-kettle.example/posts/";

const inBrowser = typeof window !== "undefined";
const delay = (ms: number) => (inBrowser ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

// ---- the clock -----------------------------------------------------------------------------------

let clockOffset = 0;
/** The mock's message clock, in seconds: the browser's clock plus however far the visitor moved it on. */
export const mockNow = (): number => Math.floor(Date.now() / 1000) + clockOffset;
/** How far the clock has been moved on, in seconds: a stable snapshot for useSyncExternalStore. */
export const mockClockOffset = (): number => clockOffset;
/** Moves the mock clock on, so a hold can be seen ending. */
export function advanceClock(seconds: number): void {
  clockOffset += Math.max(0, Math.floor(seconds));
  notify();
}

// ---- who the visitor is acting as -----------------------------------------------------------------

export type Persona = { address: string; name: string; note: string };

export const VISITOR = "0x5a0c3e7b19d24f68a1e3c5b7d9f0a2c4e6b8d0f1";
export const MY_CREATOR = "0x7c2e4a6f81b3d5a7c9e0f2a4b6d8c0e1f3a5b7c9";
export const DEMO_CREATOR = "0xd3e5f7a9b1c2d4e6f8a0b2c4d6e8f0a1b3c5d7e9";
export const EARLIER_SPONSOR = "0xb4d6f8a0c2e4a6b8d0f2c4e6a8b0d2f4c6e8a0b2";
export const PASSER_BY = "0x91c3e5a7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9";

/** The accounts a visitor can act as in mock mode. The first is a newcomer with test GEN. */
export const PERSONAS: Persona[] = [
  { address: VISITOR, name: "You, a sponsor", note: "open a brief to the demo creator and watch it read" },
  { address: MY_CREATOR, name: "You, a creator", note: "Moss & Kettle: B5 waits for you, B6 wants its post" },
  { address: EARLIER_SPONSOR, name: "Tidewell", note: "an earlier sponsor with eight briefs" },
  { address: PASSER_BY, name: "A passer-by", note: "may recheck, release and expire, and nothing else" },
  { address: DEMO_CREATOR, name: "The demo creator", note: "writes Harbour Eats" },
];

let persona = VISITOR;
/** The address the mock treats as the connected wallet. */
export const mockAddress = (): string => persona;
export function setMockPersona(address: string): void {
  if (PERSONAS.some((p) => p.address === address)) persona = address;
  notify();
}

// ---- balances -------------------------------------------------------------------------------------

const balances = new Map<string, bigint>([
  [VISITOR, 20n * GEN],
  [MY_CREATOR, 5n * GEN],
  [DEMO_CREATOR, 30n * GEN],
  [EARLIER_SPONSOR, 25n * GEN],
  [PASSER_BY, 3n * GEN],
]);
const balance = (a: string) => balances.get(a.toLowerCase()) ?? 0n;
const credit = (a: string, v: bigint) => {
  balances.set(a.toLowerCase(), balance(a) + v);
  notify();
};
/** The balance as a decimal string: a stable snapshot for useSyncExternalStore. */
export const mockBalanceText = (address: string): string => balance(address).toString();
/** The contract's own balance: every escrow held plus every credit. */
let contractBalance = 0n;

// ---- posts taken down (the demo bar can take one down, so a recheck can find it gone) -------------

const gone = new Set<string>();
export function takeDown(url: string): void {
  gone.add(url);
  notify();
}
export const isTakenDown = (url: string): boolean => gone.has(url);

// ---- the contract's state -----------------------------------------------------------------------

type BriefRec = {
  sponsor: string;
  creator: string;
  post_prefix: string;
  n_lines: number;
  fee: bigint;
  publish_by: number;
  hold_seconds: number;
  status: BriefStatus;
  opened_at: number;
  accepted_at: number;
  closed_at: number;
  tries: number;
  url_1: string;
  mask_1: string;
  fp_1: string;
  at_1: number;
  url_2: string;
  mask_2: string;
  fp_2: string;
  at_2: number;
  url: string;
  mask: string;
  met: number;
  held: bigint;
  owed: bigint;
  hold_until: number;
  to_creator: bigint;
  to_sponsor: bigint;
  fees_to_sponsor: bigint;
  n_rechecks: number;
  rechecked_at: number;
  up: string;
};

const briefRows = new Map<string, BriefRec>();
const lineRows = new Map<string, string>();
const creditRows = new Map<string, bigint>();
const lists = new Map<string, string[]>();
const n = {
  brief_count: 0,
  held_total: 0n,
  taken_total: 0n,
  credit_total: 0n,
  deposited: 0n,
  credit_out: 0n,
  to_creators: 0n,
  to_sponsors: 0n,
  fees_to_sponsors: 0n,
  returned: 0n,
  n_refused: 0,
  n_offered: 0,
  n_accepted: 0,
  n_held: 0,
  n_released: 0,
  n_taken_down: 0,
  n_hidden_ads: 0,
  n_nothing_met: 0,
  n_declined: 0,
  n_withdrawn: 0,
  n_expired: 0,
  n_submits: 0,
  n_clear: 0,
  n_unclear: 0,
  n_resubmits: 0,
  n_rechecks: 0,
};

type Row = Record<string, unknown>;
type Ctx = { sender: string; value: bigint; now: number };

/** A rule of the contract: the call raises, nothing is stored. */
class Refused extends Error {}
/** A round that cannot settle (the page could not be read): no majority, nothing stored, no fee taken. */
class NotSettled extends Error {}

const fail = (message: string): never => {
  throw new Refused("[EXPECTED] " + message);
};

const clock = (c: Ctx): number => c.now;

function idArg(raw: unknown): string {
  if (typeof raw !== "string") fail("the brief id is a string");
  return pyStrip(raw as string);
}

function briefOf(bid: string): BriefRec {
  const b = briefRows.get(bid);
  if (!b) fail("no brief " + bid.slice(0, ID_CHARS));
  return b!;
}

const creditOf = (who: string): bigint => creditRows.get(who) ?? 0n;
const linesOf = (bid: string, count: number): string[] => [DISCLOSURE, ...Array.from({ length: Math.min(count, MAX_REQUIREMENTS) }, (_, k) => lineRows.get(bid + ":" + (k + 1)) ?? "")];
const push = (key: string, id: string) => lists.set(key, [...(lists.get(key) ?? []), id]);

/** The only way value leaves the contract. */
function transfer(to: string, value: bigint): void {
  if (value <= 0n) return;
  contractBalance -= value;
  credit(to, value);
}

function refuse(sender: string, value: bigint, reason: string): Row {
  n.n_refused += 1;
  n.returned += value;
  transfer(sender, value);
  return { ok: false, reason, returned: value.toString() };
}

/** The single exit to the sponsor for whatever the brief still holds; the brief closes. */
function close(b: BriefRec, status: BriefStatus, now: number): bigint {
  const back = b.held;
  b.held = 0n;
  b.to_sponsor += back;
  b.status = status;
  b.closed_at = now;
  n.held_total -= back;
  n.to_sponsors += back;
  transfer(b.sponsor, back);
  return back;
}

/** A clear reading settles the brief. Returns what went back to the sponsor at once. */
function settle(b: BriefRec, url: string, mask: string, now: number): bigint {
  b.url = url;
  b.mask = mask;
  n.n_accepted -= 1;
  if (mask[0] !== "1") {
    n.n_hidden_ads += 1;
    return close(b, "hidden_ad", now);
  }
  const met = [...mask.slice(1)].filter((ch) => ch === "1").length;
  const fee = b.held;
  const owed = (fee * BigInt(met)) / BigInt(b.n_lines);
  b.met = met;
  b.owed = owed;
  if (owed <= 0n) {
    n.n_nothing_met += 1;
    return close(b, "nothing_met", now);
  }
  const back = fee - owed;
  b.held = owed;
  b.to_sponsor += back;
  b.status = "held";
  b.hold_until = now + b.hold_seconds;
  n.held_total -= back;
  n.to_sponsors += back;
  n.n_held += 1;
  transfer(b.sponsor, back);
  return back;
}

// ---- the writes -----------------------------------------------------------------------------------

function openBrief(c: Ctx, args: unknown[]): Row {
  const [creator, postPrefix, requirementsJson, publishBy, holdSeconds] = args;
  const value = c.value;
  const who = c.sender;
  const prefix = typeof postPrefix === "string" ? pyStrip(postPrefix) : "";
  const now = c.now;
  const problem =
    typeof postPrefix !== "string"
      ? "the post prefix is a string"
      : openProblem({ sponsor: who, creator: String(creator ?? ""), prefix, requirementsJson: String(requirementsJson ?? ""), feeAtto: value, holdSeconds: Number(numberArg(holdSeconds)), publishBy: Number(numberArg(publishBy)), now });
  if (problem) return refuse(who, value, problem);
  const { lines } = requirementsOf(requirementsJson);
  const mate = String(creator).trim().toLowerCase();
  const deadline = Number(numberArg(publishBy));
  const hold = Number(numberArg(holdSeconds));
  n.brief_count += 1;
  const bid = "B" + n.brief_count;
  briefRows.set(bid, {
    sponsor: who,
    creator: mate,
    post_prefix: prefix,
    n_lines: lines.length,
    fee: value,
    publish_by: deadline,
    hold_seconds: hold,
    status: "offered",
    opened_at: now,
    accepted_at: 0,
    closed_at: 0,
    tries: 0,
    url_1: "",
    mask_1: "",
    fp_1: "",
    at_1: 0,
    url_2: "",
    mask_2: "",
    fp_2: "",
    at_2: 0,
    url: "",
    mask: "",
    met: 0,
    held: value,
    owed: 0n,
    hold_until: 0,
    to_creator: 0n,
    to_sponsor: 0n,
    fees_to_sponsor: 0n,
    n_rechecks: 0,
    rechecked_at: 0,
    up: "",
  });
  lines.slice(0, MAX_REQUIREMENTS).forEach((line, k) => lineRows.set(bid + ":" + (k + 1), line));
  n.held_total += value;
  n.taken_total += value;
  n.n_offered += 1;
  push("party:" + who, bid);
  push("party:" + mate, bid);
  return {
    ok: true,
    brief: bid,
    sponsor: who,
    creator: mate,
    post_prefix: prefix,
    requirements: [DISCLOSURE, ...lines],
    fee: value.toString(),
    publish_by: deadline,
    hold_seconds: hold,
    held: value.toString(),
    status: "offered",
    opened_at: now,
  };
}

function withdrawBrief(c: Ctx, raw: unknown): Row {
  const bid = idArg(raw);
  const b = briefOf(bid);
  if (c.sender !== b.sponsor) fail("only the sponsor of " + bid + " may withdraw it");
  if (b.status !== "offered") fail(bid + " is " + b.status + "; only a brief the creator has not accepted can be withdrawn");
  const now = clock(c);
  n.n_offered -= 1;
  n.n_withdrawn += 1;
  const back = close(b, "withdrawn", now);
  return { ok: true, brief: bid, status: "withdrawn", to_sponsor: back.toString() };
}

function decline(c: Ctx, raw: unknown): Row {
  const bid = idArg(raw);
  const b = briefOf(bid);
  if (c.sender !== b.creator) fail("only the creator of " + bid + " may decline it");
  if (b.status !== "offered") fail(bid + " is " + b.status + "; only a brief not yet accepted can be declined");
  const now = clock(c);
  n.n_offered -= 1;
  n.n_declined += 1;
  const back = close(b, "declined", now);
  return { ok: true, brief: bid, status: "declined", to_sponsor: back.toString() };
}

function accept(c: Ctx, raw: unknown): Row {
  const bid = idArg(raw);
  const b = briefOf(bid);
  if (c.sender !== b.creator) fail("only the creator of " + bid + " may accept it");
  if (b.status !== "offered") fail(bid + " is " + b.status + "; only an offered brief can be accepted");
  const now = clock(c);
  if (now >= b.publish_by)
    fail("publish_by of " + bid + " passed at " + b.publish_by + "; a brief is accepted before it, and now only the sponsor can withdraw it or the creator decline it");
  b.status = "accepted";
  b.accepted_at = now;
  n.n_offered -= 1;
  n.n_accepted += 1;
  return { ok: true, brief: bid, status: "accepted", publish_by: b.publish_by, submit_closes: b.publish_by + SUBMIT_GRACE, accepted_at: now };
}

function deposit(c: Ctx): Row {
  const value = c.value;
  const who = c.sender;
  if (value <= 0n) return refuse(who, value, "send the amount to deposit with the call; nothing was sent");
  const total = creditOf(who) + value;
  creditRows.set(who, total);
  n.credit_total += value;
  n.deposited += value;
  return { ok: true, address: who, deposited: value.toString(), credit: total.toString() };
}

function withdraw(c: Ctx): Row {
  const who = c.sender;
  const amount = creditOf(who);
  if (amount <= 0n) fail("there is no credit to withdraw for " + who);
  creditRows.set(who, 0n);
  n.credit_total -= amount;
  n.credit_out += amount;
  transfer(who, amount);
  return { ok: true, address: who, withdrawn: amount.toString(), credit: "0" };
}

/** The scripted round: a demo post's known answer, unclear for an unknown line, nothing stored for an unreadable address. */
function judge(lines: string[], url: string): { mask: string; fp: string } {
  if (isTakenDown(url)) throw new NotSettled("[TRANSIENT] the post answered with status " + GONE_STATUSES[0] + "; only a 2xx answer is a post, nothing was stored and no fee was taken");
  const r = scriptedReading(url, lines);
  if ("error" in r) throw new NotSettled(r.error);
  return r;
}

function submit(c: Ctx, rawId: unknown, rawUrl: unknown): Row {
  if (typeof rawId !== "string" || typeof rawUrl !== "string") fail("the brief id and the post address are strings");
  const bid = pyStrip(rawId as string);
  const url = pyStrip(rawUrl as string);
  const b = briefOf(bid);
  const who = c.sender;
  if (who !== b.creator) fail("only the creator of " + bid + " may submit a post for it");
  if (b.status !== "accepted") fail(bid + " is " + b.status + "; a post is submitted while the brief is accepted");
  const problem = urlProblem(url, MAX_URL, "the post address");
  if (problem) fail(problem);
  if (!under(url, b.post_prefix)) fail("the post is not below " + bid + "'s post prefix " + b.post_prefix + "; only the creator's own site is read");
  const now = clock(c);
  const closes = b.publish_by + SUBMIT_GRACE;
  if (now >= closes) fail("submissions for " + bid + " closed at " + closes + ", a day after publish_by; anyone may expire it now, and the fee goes back to the sponsor");
  let tries = b.tries;
  if (tries >= MAX_SUBMITS) fail(bid + " has had its submission and its one re-submission; it expires at " + closes);
  let have = creditOf(who);
  if (have < SUBMIT_FEE) fail("a submission takes a fee of " + SUBMIT_FEE + " atto from the creator's credit, and the credit is " + have + "; deposit first");
  const lines = linesOf(bid, b.n_lines);
  const { mask, fp } = judge(lines, url);
  tries += 1;
  if (tries === 1) Object.assign(b, { url_1: url, mask_1: mask, fp_1: fp, at_1: now });
  else {
    Object.assign(b, { url_2: url, mask_2: mask, fp_2: fp, at_2: now });
    n.n_resubmits += 1;
  }
  b.tries = tries;
  n.n_submits += 1;
  let fee = "kept";
  let back = 0n;
  if (mask === UNCLEAR) {
    fee = "to_sponsor";
    have -= SUBMIT_FEE;
    creditRows.set(who, have);
    n.credit_total -= SUBMIT_FEE;
    n.fees_to_sponsors += SUBMIT_FEE;
    b.fees_to_sponsor += SUBMIT_FEE;
    n.n_unclear += 1;
    transfer(b.sponsor, SUBMIT_FEE);
  } else {
    n.n_clear += 1;
    back = settle(b, url, mask, now);
  }
  return {
    ok: true,
    brief: bid,
    try: tries,
    url,
    mask,
    fp,
    met: b.met,
    of: b.n_lines,
    status: b.status,
    owed: b.owed.toString(),
    held: b.held.toString(),
    hold_until: b.hold_until,
    to_sponsor: back.toString(),
    fee,
    credit: have.toString(),
    at: now,
  };
}

/** The scripted recheck: a demo post is up unless the demo bar took it down; any other address stores nothing. */
function probe(url: string): string {
  if (isTakenDown(url)) return UP_GONE;
  if (postOfUrl(url)) return UP_YES;
  throw new NotSettled("[TRANSIENT] the post could not be fetched; nothing was stored, and it may be rechecked again");
}

function recheck(c: Ctx, raw: unknown): Row {
  const bid = idArg(raw);
  const b = briefOf(bid);
  if (b.status !== "held") fail(bid + " is " + b.status + "; a post is rechecked while its pay is held");
  const now = clock(c);
  if (now >= b.hold_until) fail("the hold of " + bid + " ended at " + b.hold_until + "; anyone may release it now");
  const up = probe(b.url);
  b.n_rechecks += 1;
  b.rechecked_at = now;
  b.up = up;
  n.n_rechecks += 1;
  let back = 0n;
  if (up === UP_GONE) {
    n.n_held -= 1;
    n.n_taken_down += 1;
    back = close(b, "taken_down", now);
  }
  return { ok: true, brief: bid, url: b.url, up, status: b.status, to_sponsor: back.toString(), held: b.held.toString(), hold_until: b.hold_until, rechecks: b.n_rechecks, at: now };
}

function release(c: Ctx, raw: unknown): Row {
  const bid = idArg(raw);
  const b = briefOf(bid);
  if (b.status !== "held") fail(bid + " is " + b.status + "; only held pay is released");
  const now = clock(c);
  if (now < b.hold_until) fail("the hold of " + bid + " ends at " + b.hold_until + ", in " + (b.hold_until - now) + " seconds; until then anyone may recheck the post");
  const paid = b.held;
  b.held = 0n;
  b.to_creator += paid;
  b.status = "released";
  b.closed_at = now;
  n.held_total -= paid;
  n.to_creators += paid;
  n.n_held -= 1;
  n.n_released += 1;
  transfer(b.creator, paid);
  return { ok: true, brief: bid, status: "released", to_creator: paid.toString(), at: now };
}

function expire(c: Ctx, raw: unknown): Row {
  const bid = idArg(raw);
  const b = briefOf(bid);
  const status = b.status;
  if (status !== "offered" && status !== "accepted") fail(bid + " is " + status + "; only a brief still waiting for its post can expire");
  const now = clock(c);
  const closes = b.publish_by + SUBMIT_GRACE;
  if (now < closes) fail(bid + " can expire from " + closes + ", a day after publish_by, in " + (closes - now) + " seconds");
  if (status === "offered") n.n_offered -= 1;
  else n.n_accepted -= 1;
  n.n_expired += 1;
  const back = close(b, "expired", now);
  return { ok: true, brief: bid, status: "expired", to_sponsor: back.toString(), at: now };
}

function run(fn: WriteFn, args: unknown[], c: Ctx): Row {
  switch (fn) {
    case "open_brief":
      return openBrief(c, args);
    case "withdraw_brief":
      return withdrawBrief(c, args[0]);
    case "decline":
      return decline(c, args[0]);
    case "accept":
      return accept(c, args[0]);
    case "deposit":
      return deposit(c);
    case "withdraw":
      return withdraw(c);
    case "submit":
      return submit(c, args[0], args[1]);
    case "recheck":
      return recheck(c, args[0]);
    case "release":
      return release(c, args[0]);
    case "expire":
      return expire(c, args[0]);
  }
}

// ---- the views ------------------------------------------------------------------------------------

function can(b: BriefRec, now: number): Row {
  const known = now >= 0;
  const closes = b.publish_by + SUBMIT_GRACE;
  return {
    accept: known && b.status === "offered" && now < b.publish_by,
    submit: known && b.status === "accepted" && now < closes && b.tries < MAX_SUBMITS,
    recheck: known && b.status === "held" && now < b.hold_until,
    release: known && b.status === "held" && now >= b.hold_until,
    expire: known && (b.status === "offered" || b.status === "accepted") && now >= closes,
  };
}

function rowOf(bid: string): Row {
  const b = briefRows.get(bid)!;
  const submissions: Row[] = [];
  if (b.tries >= 1) submissions.push({ url: b.url_1, mask: b.mask_1, fp: b.fp_1, at: b.at_1 });
  if (b.tries >= 2) submissions.push({ url: b.url_2, mask: b.mask_2, fp: b.fp_2, at: b.at_2 });
  return {
    brief: bid,
    sponsor: b.sponsor,
    creator: b.creator,
    post_prefix: b.post_prefix,
    requirements: linesOf(bid, b.n_lines),
    of: b.n_lines,
    fee: b.fee.toString(),
    publish_by: b.publish_by,
    submit_closes: b.publish_by + SUBMIT_GRACE,
    hold_seconds: b.hold_seconds,
    status: b.status,
    opened_at: b.opened_at,
    accepted_at: b.accepted_at,
    closed_at: b.closed_at,
    tries: b.tries,
    submissions,
    url: b.url,
    mask: b.mask,
    met: b.met,
    held: b.held.toString(),
    owed: b.owed.toString(),
    hold_until: b.hold_until,
    to_creator: b.to_creator.toString(),
    to_sponsor: b.to_sponsor.toString(),
    fees_to_sponsor: b.fees_to_sponsor.toString(),
    rechecks: b.n_rechecks,
    rechecked_at: b.rechecked_at,
    up: b.up,
    submit_fee: SUBMIT_FEE.toString(),
  };
}

function pageOf(offset: unknown, limit: unknown): { start: number; size: number } {
  const start = Math.max(Number(numberArg(offset)), 0);
  let size = Number(numberArg(limit));
  size = size < 1 || size > PAGE ? PAGE : size;
  return { start, size };
}

/** rules(), word for word as the contract answers it (tests/unit/interface.test.mjs compares the two whole). */
const RULES = {
  disclosure: DISCLOSURE,
  submit: {
    value: '{"mask": "<one character per line, line 0 first: 1 met, 0 not>", "fp": "<hex16>"} or {"mask": "unclear", "fp": "<hex16>"}',
    askings: [
      "1, requirements as listed: " + QUESTION_MET,
      "2, requirements reversed and renumbered: " + QUESTION_MET,
      "3, requirements as listed: " + QUESTION_UNMET,
      "4, requirements reversed and renumbered: " + QUESTION_UNMET,
    ],
    rules: READING,
    answer: RETURN_LIST,
    numbering:
      "line 0 is the disclosure, then the sponsor's lines 1 to n; reversed, every line is relabelled, so the line numbered k holds the line listed at n - k and the disclosure is numbered n; the answer is mapped back in code",
    page:
      "every validator fetches the post itself, once; a status outside 2xx stores nothing; the tags are removed (and the text after a script or style tag), the spacing of at most " +
      MAX_RAW_PAGE +
      " characters is collapsed, at most " +
      MAX_PAGE_TEXT +
      " characters are judged, and the fingerprint is the first " +
      FP_CHARS +
      " hex characters of their sha256",
    reading_an_answer:
      "asked in JSON mode; the whole reply must be an object whose only key is answer, or a bare JSON list, at most 400 characters with at most one surrounding ``` fence removed; nothing is searched for inside prose; the list holds distinct whole numbers from 0 to n; anything else is unreadable",
    combine: {
      mask: "both MET answers agree, both UNMET answers agree, and every line, the disclosure included, is in exactly one of the two lists",
      unclear: "anything else, an unreadable answer included",
    },
    outcome: {
      hidden_ad: "line 0 unmet: nothing is owed; the whole fee back to the sponsor; the brief closes",
      mask: "owed = fee * sponsor lines met // sponsor lines, held until the hold ends; the rest back to the sponsor at once",
      nothing_met: "line 0 met and no sponsor line met: owed is 0; the whole fee back to the sponsor; the brief closes",
      unclear: "nothing moves from the escrow; the submit fee goes to the sponsor; the creator may submit once more",
    },
  },
  recheck: {
    value: '{"up": "yes"} or {"up": "gone"}',
    how: "every validator fetches the same address once and asks no model: status " + GONE_STATUSES.join(" or ") + " is gone, 2xx is yes, anything else or a failed fetch stores nothing",
  },
  compared: "the whole value, by exact equality; every validator does the leader's work itself inside one consensus block, and never agrees with a leader that raised",
  windows:
    "accept before publish_by; submit until publish_by + " +
    SUBMIT_GRACE +
    " seconds; recheck while held and before hold_until; release from hold_until; expire from publish_by + " +
    SUBMIT_GRACE +
    " seconds; time comes from the transaction's own datetime",
  money: {
    open_brief: "the sponsor sends the fee, " + MIN_FEE + " to " + MAX_FEE + " atto (0.1 to 50 GEN); it is held here",
    withdraw_brief: "before acceptance, the sponsor: the whole fee back to the sponsor",
    decline: "before acceptance, the creator: the whole fee back to the sponsor",
    submit_hidden_ad: "the whole fee back to the sponsor; nothing to the creator",
    submit_mask: "fee * met // n held for the creator until hold_until, rounded down; the rest back to the sponsor at once",
    submit_fee: "a clear reading leaves the " + SUBMIT_FEE + " atto submit fee in the creator's credit; an unclear one moves it to the sponsor",
    recheck_gone: "the held part back to the sponsor; the brief closes",
    recheck_up: "nothing moves",
    release: "the held part to the creator",
    expire: "the whole fee back to the sponsor",
    deposit: "the value sent joins the sender's own credit",
    withdraw: "the sender's whole credit back to the sender",
    refusal: "a refused payable call returns everything sent, in the same transaction",
    balance: "the contract holds exactly the escrow of offered, accepted and held briefs plus every credit",
  },
  who: {
    open_brief: "anyone; the sender is the sponsor; the creator is another address",
    withdraw_brief: "the sponsor, while the brief is not accepted",
    decline: "the creator, while the brief is not accepted",
    accept: "the creator, before publish_by",
    deposit: "anyone, into its own credit",
    withdraw: "anyone, its own credit",
    submit: "the creator, after accepting, until publish_by + one day; once, and once more only after an unclear reading; the post below the brief's post prefix",
    recheck: "anyone, while the pay is held",
    release: "anyone, once the hold has ended",
    expire: "anyone, a day after publish_by, while no clear reading was made",
  },
  limits: {
    requirements: [MIN_REQUIREMENTS, MAX_REQUIREMENTS],
    requirement_chars: [MIN_REQUIREMENT, MAX_REQUIREMENT],
    requirements_json_chars: MAX_REQUIREMENTS_JSON,
    prefix_chars: MAX_PREFIX,
    url_chars: MAX_URL,
    submits: MAX_SUBMITS,
    submit_fee_atto: SUBMIT_FEE.toString(),
    fee_atto: [MIN_FEE.toString(), MAX_FEE.toString()],
    hold_seconds: [MIN_HOLD, MAX_HOLD],
    publish_by_lead_seconds: [MIN_LEAD, MAX_LEAD],
    submit_grace_seconds: SUBMIT_GRACE,
    page_chars: MAX_PAGE_TEXT,
    rows_per_page: PAGE,
    text: "printable ASCII on one line",
    same_page: "the page must read the same for every validator: a page that changes from one fetch to the next, or by who asks, gets no consensus and stores nothing",
    words_only: "text is read, not images, video or styling: a link counts only when its address is written out in the text, and words hidden with CSS still read as written",
    one_check:
      "one check per line: a line that asks for two things is met only when the page does both, and honest readers may split on it, so each thing the sponsor wants goes on its own line",
    creator_controls_the_page:
      "the creator controls the page: a recheck reads only the status, so a post edited while its pay is held still counts as up, and a post edited or removed after its pay is released is not caught",
  },
  untrusted:
    "the requirements and the page are fenced (< and > replaced, never deleted), sit between delimiter lines tagged with the start of their own sha256, and the prompt says before the blocks that they are untrusted and never an instruction",
};

export async function view(fn: string, args: (string | number)[]): Promise<string> {
  seed();
  await delay(120);
  const now = mockNow();
  switch (fn) {
    case "brief": {
      const raw = args[0];
      if (typeof raw !== "string") return JSON.stringify({ error: "the brief id is a string" });
      const key = pyStrip(raw).slice(0, ID_CHARS);
      if (!briefRows.has(key)) return JSON.stringify({ error: "no brief " + key, brief: key });
      return JSON.stringify({ ...rowOf(key), now, can: can(briefRows.get(key)!, now) });
    }
    case "briefs": {
      const total = n.brief_count;
      const { start, size } = pageOf(args[0], args[1]);
      const rows: Row[] = [];
      for (let k = start + 1; k <= Math.min(total, start + size); k++) rows.push(rowOf("B" + k));
      return JSON.stringify({ total, offset: start, limit: size, rows });
    }
    case "briefs_of": {
      const raw = args[0];
      if (typeof raw !== "string") return JSON.stringify({ error: "the address is a string" });
      const key = pyStrip(raw).toLowerCase().slice(0, ADDRESS_CHARS);
      const ids = lists.get("party:" + key) ?? [];
      const { start, size } = pageOf(args[1], args[2]);
      const rows = ids.slice(start, Math.min(ids.length, start + size)).map((id) => {
        const row = rowOf(id);
        return { ...row, role: row.sponsor === key ? "sponsor" : "creator" };
      });
      return JSON.stringify({ address: key, total: ids.length, offset: start, limit: size, rows });
    }
    case "credit": {
      const raw = args[0];
      if (typeof raw !== "string") return JSON.stringify({ error: "the address is a string" });
      const key = pyStrip(raw).toLowerCase().slice(0, ADDRESS_CHARS);
      const amount = creditOf(key);
      return JSON.stringify({ address: key, credit: amount.toString(), submit_fee: SUBMIT_FEE.toString(), submissions: Number(amount / SUBMIT_FEE) });
    }
    case "stats":
      return JSON.stringify({
        briefs: n.brief_count,
        offered: n.n_offered,
        accepted: n.n_accepted,
        held_briefs: n.n_held,
        released: n.n_released,
        taken_down: n.n_taken_down,
        hidden_ads: n.n_hidden_ads,
        nothing_met: n.n_nothing_met,
        declined: n.n_declined,
        withdrawn: n.n_withdrawn,
        expired: n.n_expired,
        submits: n.n_submits,
        clear: n.n_clear,
        unclear: n.n_unclear,
        resubmits: n.n_resubmits,
        rechecks: n.n_rechecks,
        held: n.held_total.toString(),
        taken: n.taken_total.toString(),
        to_creators: n.to_creators.toString(),
        to_sponsors: n.to_sponsors.toString(),
        fees_to_sponsors: n.fees_to_sponsors.toString(),
        credit: n.credit_total.toString(),
        deposited: n.deposited.toString(),
        credit_withdrawn: n.credit_out.toString(),
        refused_payments: n.n_refused,
        returned: n.returned.toString(),
      });
    case "rules":
      return JSON.stringify(RULES);
  }
  throw new Error("no view " + fn);
}

// ---- transactions ---------------------------------------------------------------------------------

type Pending = { fn: WriteFn; polls: number; result: Row; error: string; judged: boolean; settled: boolean };
const pending = new Map<string, Pending>();
let txCount = 0;
const fakeHash = () => "0x" + (++txCount).toString(16).padStart(8, "0") + "ad5c0e1b".repeat(7);

/** Runs one call from `sender` now and remembers how it went, as the chain would for its hash. */
function send(sender: string, fn: WriteFn, args: unknown[], value: bigint): string {
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  let result: Row = {};
  let error = "";
  let settledRound = true;
  try {
    result = run(fn, args, { sender, value, now: mockNow() });
  } catch (e) {
    if (!(e instanceof Refused) && !(e instanceof NotSettled)) throw e;
    // A raised refusal changes nothing; no write that takes value raises, but the value goes back regardless.
    if (value > 0n) {
      contractBalance -= value;
      credit(sender, value);
    }
    error = e.message;
    settledRound = !(e instanceof NotSettled);
  }
  const hash = fakeHash();
  const judged = (fn === "submit" || fn === "recheck") && (!error || !settledRound);
  pending.set(hash, { fn, polls: 0, result, error, judged, settled: settledRound });
  notify();
  return hash;
}

export async function write(call: Call): Promise<string> {
  seed();
  await delay(250);
  return send(persona.toLowerCase(), call.fn, call.args, call.value ?? 0n);
}

const STAGES = ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "FINALIZED"];
const NO_VOTES = { agree: 0, disagree: 0, idle: 0 };

export async function txStatus(hash: string): Promise<TxStatus> {
  await delay(60);
  const p = pending.get(hash);
  if (!p) return { status: "UNKNOWN", votes: NO_VOTES, applied: null, undetermined: false, exec: null, result: null, message: "" };
  p.polls += 1;
  // A judged call fetches a page on every validator (and a submission asks four questions), so it moves slower.
  const stages = p.judged ? Math.max(1, Math.floor(p.polls / 2)) : p.polls;
  const done = stages >= STAGES.length;
  if (!p.settled) {
    // The page could not be read: every validator disagrees with a leader that raised, and the round
    // ends with no majority. Nothing is stored.
    const disagree = done ? 4 : Math.min(Math.max(0, stages - 2), 4);
    return {
      status: done ? "UNDETERMINED" : STAGES[Math.min(stages - 1, STAGES.length - 2)],
      votes: { agree: 0, disagree, idle: done || disagree ? 5 - disagree : 0 },
      applied: done ? false : null,
      undetermined: done,
      exec: done ? "ERROR" : null,
      result: null,
      message: done ? p.error : "",
    };
  }
  // Studio assigns five validators and one is often idle in a round; the mock shows the same shape.
  const agree = done ? 4 : p.judged ? Math.min(Math.max(0, stages - 2), 4) : 0;
  return {
    status: STAGES[Math.min(stages - 1, STAGES.length - 1)],
    votes: { agree, disagree: 0, idle: done || agree ? 5 - agree : 0 },
    applied: done ? true : null,
    undetermined: false,
    exec: done ? (p.error ? "ERROR" : "SUCCESS") : null,
    result: done && !p.error ? p.result : null,
    message: done ? p.error || JSON.stringify(p.result) : "",
  };
}

/** True once a transaction the mock knows has been polled to a final status (or it never existed). */
const isDone = (hash: string): boolean => {
  const p = pending.get(hash);
  if (!p) return true;
  return (p.judged ? Math.floor(p.polls / 2) : p.polls) >= STAGES.length;
};

export async function balanceOf(address: string): Promise<bigint> {
  await delay(40);
  return balance(address);
}

export async function faucet(address: string): Promise<bigint> {
  await delay(500);
  credit(address, 10n * GEN);
  return balance(address);
}

// ---- the demo creator ------------------------------------------------------------------------------

export function demoStatus(): DemoStatus {
  return { online: true, creator: DEMO_CREATOR, reason: "", posts: true, postsReason: "", prefix: MOCK_PREFIX };
}

/** The demo creator's last transaction per brief: it acts one move at a time. */
const lastDemoTx = new Map<string, string>();

function demoBrief(raw: string): { id: string; creator: string; postPrefix: string; status: string; can: { accept: boolean; submit: boolean } } | null {
  const id = pyStrip(String(raw ?? "")).slice(0, ID_CHARS);
  const b = briefRows.get(id);
  if (!b) return null;
  const c = can(b, mockNow());
  return { id, creator: b.creator, postPrefix: b.post_prefix, status: b.status, can: { accept: c.accept === true, submit: c.submit === true } };
}

/** The in-memory twin of POST /api/demo/accept: the demo creator accepts an offered brief made to it. */
export async function demoAccept(raw: string): Promise<DemoAnswer> {
  seed();
  await delay(300);
  const b = demoBrief(raw);
  const problem = demoProblem(b, DEMO_CREATOR, MOCK_PREFIX, "accept");
  if (problem) return { ok: false, reason: problem };
  const last = lastDemoTx.get(b!.id);
  if (last && !isDone(last)) return { ok: false, reason: `the demo creator is still waiting for its last move on ${b!.id} to be final; try again once it is` };
  const hash = send(DEMO_CREATOR, "accept", [b!.id], 0n);
  lastDemoTx.set(b!.id, hash);
  return { ok: true, hash };
}

/** The in-memory twin of POST /api/demo/post: the demo creator tops up its credit when it must, and submits one fixed post. */
export async function demoPost(raw: string, key: string): Promise<DemoAnswer> {
  seed();
  await delay(300);
  const b = demoBrief(raw);
  const problem = demoProblem(b, DEMO_CREATOR, MOCK_PREFIX, key);
  if (problem) return { ok: false, reason: problem };
  const last = lastDemoTx.get(b!.id);
  if (last && !isDone(last)) return { ok: false, reason: `the demo creator is still waiting for its last move on ${b!.id} to be final; try again once it is` };
  let deposited: string | undefined;
  if (creditOf(DEMO_CREATOR) < SUBMIT_FEE) deposited = send(DEMO_CREATOR, "deposit", [], DEMO_DEPOSIT);
  const hash = send(DEMO_CREATOR, "submit", [b!.id, mockPost(key as PostKey)], 0n);
  lastDemoTx.set(b!.id, hash);
  return deposited ? { ok: true, hash, deposit: deposited } : { ok: true, hash };
}

/** What the demo creator deposits when its credit runs out: five submissions. */
export const DEMO_DEPOSIT = SUBMIT_FEE * 5n;

// ---- seeding ---------------------------------------------------------------------------------------

let seeded = false;

/** Runs a call at a given instant, outside the transaction log: the seeded past. */
function at(sender: string, now: number, fn: WriteFn, args: unknown[], value = 0n): Row {
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  return run(fn, args, { sender, value, now });
}

function seed(): void {
  if (seeded) return;
  seeded = true;
  const now = mockNow();
  const MIN = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const T = EARLIER_SPONSOR;
  const D = DEMO_CREATOR;
  const M = MY_CREATOR;
  const lines = JSON.stringify(DEMO_LINES);
  const fee = (9n * GEN) / 10n;
  const W = DEMO_WINDOWS;
  at(D, now - 6 * DAY, "deposit", [], DEMO_DEPOSIT);
  // B1: the full post, every line met; the hold ran out and a passer-by released the whole fee.
  let t = now - 5 * DAY;
  at(T, t, "open_brief", [D, MOCK_PREFIX, lines, t + W.publishSeconds, W.holdSeconds], fee);
  at(D, t + 2 * MIN, "accept", ["B1"]);
  at(D, t + 9 * MIN, "submit", ["B1", mockPost("full")]);
  at(PASSER_BY, t + 9 * MIN + W.holdSeconds + MIN, "release", ["B1"]);
  // B2: the same post with no #ad: a hidden ad, the whole fee back to the sponsor.
  t = now - 4 * DAY;
  at(T, t, "open_brief", [D, MOCK_PREFIX, lines, t + W.publishSeconds, W.holdSeconds], fee);
  at(D, t + MIN, "accept", ["B2"]);
  at(D, t + 6 * MIN, "submit", ["B2", mockPost("no-disclosure")]);
  // B3: disclosed, no link: two thirds held for a day, still running, so anyone may recheck it.
  t = now - 3 * HOUR;
  at(T, t, "open_brief", [D, MOCK_PREFIX, lines, t + 2 * HOUR, DAY], fee);
  at(D, t + 2 * MIN, "accept", ["B3"]);
  at(D, t + 20 * MIN, "submit", ["B3", mockPost("no-link")]);
  // B4: the wrong bag: disclosed, but nothing met, the whole fee back.
  t = now - 2 * DAY;
  at(T, t, "open_brief", [D, MOCK_PREFIX, lines, t + W.publishSeconds, W.holdSeconds], fee);
  at(D, t + MIN, "accept", ["B4"]);
  at(D, t + 4 * MIN, "submit", ["B4", mockPost("wrong-product")]);
  // B5: a brief to the "You, a creator" persona, waiting for it to accept or decline.
  t = now - 2 * HOUR;
  at(T, t, "open_brief", [M, MY_SITE, JSON.stringify(["Mentions the Tidewell 20 L dry bag by name", "Mentions that the bag comes in orange"]), t + 2 * DAY, HOUR], (6n * GEN) / 10n);
  // B6: accepted by the persona, waiting for its post.
  t = now - 5 * HOUR;
  at(T, t, "open_brief", [M, MY_SITE, lines, t + DAY, HOUR], fee);
  at(M, t + 30 * MIN, "accept", ["B6"]);
  at(M, t + 31 * MIN, "deposit", [], SUBMIT_FEE * 3n);
  // B7: a line the demo build cannot read: unclear, the submit fee went to the sponsor, one more try is left.
  t = now - 6 * HOUR;
  at(T, t, "open_brief", [M, MY_SITE, JSON.stringify([DEMO_LINES[0], "Says the bag is sewn from recycled sailcloth"]), t + DAY, HOUR], (6n * GEN) / 10n);
  at(M, t + 10 * MIN, "accept", ["B7"]);
  at(M, t + 40 * MIN, "submit", ["B7", MY_SITE + "full.html"]);
  // B8: nobody accepted it in time; a passer-by expired it a day after publish_by and the fee went back.
  t = now - 4 * DAY;
  at(T, t, "open_brief", [M, MY_SITE, lines, t + HOUR, HOUR], (3n * GEN) / 10n);
  at(PASSER_BY, t + HOUR + DAY + 5 * MIN, "expire", ["B8"]);
}

/** Test hook: the contract's held escrow and credit, and its own balance, which must be their sum. */
export function mockTotals(): { held: bigint; credit: bigint; balance: bigint } {
  seed();
  return { held: n.held_total, credit: n.credit_total, balance: contractBalance };
}

/** Every account the mock knows, for the tests' conservation checks. */
export const ACCOUNTS = [VISITOR, MY_CREATOR, DEMO_CREATOR, EARLIER_SPONSOR, PASSER_BY];
