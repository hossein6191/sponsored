// Chain access for Sponsored: the ONE file that knows the contract's interface.
//
// Every method name, argument order, view shape and outcome word of contracts/sponsored.py that the site
// depends on is written here (and in lib/calls.ts) and nowhere else. Pages import typed reads, typed
// call builders and mapped outcomes from this module; lib/chain-mock.ts stands in for the contract in
// mock mode and answers in the contract's own JSON, so the mappers below run in both modes.
//
// Reads go through readContract (gen_call) with the retry policy in lib/rpc.ts: eight tries over about
// forty seconds, because Studio answers "Contract not found" for a healthy contract for about a minute
// after a deploy. A failed read is never "no data" and never proof that a write failed. Studio allows 30
// gen_call a minute from one browser (the faucet shares them), so every view answer is cached for 30 s,
// two components asking for the same view share one request, and invalidateReads() drops the cache once
// a transaction is final.

import * as mock from "./chain-mock";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress, type Address } from "viem";
import { notify } from "./browser-store";
import { contractAddress, demoCreatorFallback } from "./config";
import { RATE_LIMITED, createReadCache, isMissingMethodError, noteFailure, rpc, sleep, waitForCooldown, withRetry, decodeTx, type RawTx } from "./rpc";
import { PAGE, STATUSES, idNumber, sentence, type BriefStatus } from "./rules";
import type { Arg, Brief, Call, Can, Credit, DemoAnswer, DemoStatus, Paged, ReadResult, Rules, Stats, Submission, TxStatus, WriteFn } from "./types";
import { chainName, getChainId, getSigner } from "./wallet";

export { RATE_LIMITED, cooldownRemainingMs } from "./rpc";
export { contractAddress };
export { calls } from "./calls";

export const CHAIN_ID = 61999;
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

export const isMock = process.env.NEXT_PUBLIC_MOCK === "1";

export const NETWORK_ERROR = "could not reach the network";
/** Thrown by reads while the site has no contract address. */
export const NO_CONTRACT = "the contract is not deployed yet";
/** What the faucet says when Studio refused sim_fundAccount three times. */
export const FAUCET_REFUSED = "Studio refused the faucet request (it allows 30 requests a minute from one browser). Try again in a minute.";

/** True when this site has a contract to read: always in mock mode. */
export const hasContract = (): boolean => isMock || !!contractAddress();

/** The contract the explorer links point at. */
export const contractInUse = (): string => (isMock ? mock.MOCK_CONTRACT : contractAddress());

// ---- low-level view access ------------------------------------------------------------------------

// The SDK's studionet object carries another explorer URL; the RPC and explorer hosts are set here.
export const studio = {
  ...studionet,
  rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "GenLayer Studio Explorer", url: EXPLORER_URL } },
};

const reader = () => createClient({ chain: studio });

type Row = Record<string, unknown>;

const num = (v: unknown, dflt = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : dflt;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
  return dflt;
};
const str = (v: unknown, dflt = ""): string => (v === undefined || v === null ? dflt : String(v));
const atto = (v: unknown): string => {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? BigInt(Math.trunc(v)).toString() : "0";
  const s = str(v, "0").trim();
  return /^\d+$/.test(s) ? s : "0";
};
const addr = (v: unknown): string => str(v).toLowerCase();
/** Seconds; the contract writes -1 or 0 when a call had no readable clock. */
const secs = (v: unknown): number => Math.max(0, num(v));
const asRow = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const rowsOf = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object" && !Array.isArray(r)) : []);
const fp = (v: unknown): string => (/^[0-9a-f]{16}$/.test(str(v)) ? str(v) : "");
const mask = (v: unknown): string => (/^([01]{2,6}|unclear)$/.test(str(v)) ? str(v) : "");

/** A view returns a JSON string; parse it. Some decoders already hand back the object. */
function parseView(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** How long a view answer is reused. */
export const READ_TTL_MS = 30_000;
const onServer = typeof window === "undefined";
const views = createReadCache<unknown>(onServer ? 0 : READ_TTL_MS);

let moved = 0;
/** How many times the chain has moved under this page (a final transaction, a faucet payment): a stable snapshot. */
export const chainVersion = (): number => moved;

/** Forget every cached view answer, and tell the lists on screen to read again. */
export const invalidateReads = () => {
  views.clear();
  moved++;
  notify();
};

/**
 * One view call through the cache. Throws RATE_LIMITED when Studio is rate-limiting this browser,
 * NO_CONTRACT when no contract is set, and the plain network error when Studio never answered.
 */
async function view(fn: string, args: Arg[] = [], opts: { fresh?: boolean } = {}): Promise<unknown> {
  if (isMock) return parseView(await mock.view(fn, args as (string | number)[]));
  const address = contractAddress();
  if (!address) throw new Error(NO_CONTRACT);
  const key = `${address.toLowerCase()}|${fn}|${JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`;
  if (opts.fresh) views.forget(key);
  try {
    const raw = await views.get(key, () =>
      withRetry(() => reader().readContract({ address: address as Address, functionName: fn, args }), {
        bucket: "gen",
        giveUp: isMissingMethodError,
      }),
    );
    return parseView(raw);
  } catch (e) {
    if (e instanceof Error && e.message === RATE_LIMITED) throw e;
    throw new Error(NETWORK_ERROR);
  }
}

const SOURCE: ReadResult<unknown>["source"] = isMock ? "mock" : "chain";
const result = <T>(data: T): ReadResult<T> => ({ data, source: SOURCE });

// ---- row mappers (every missing field gets a default) -----------------------------------------------

const status = (v: unknown): BriefStatus => (STATUSES.includes(str(v) as BriefStatus) ? (str(v) as BriefStatus) : "offered");

function mapCan(v: unknown): Can | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Row;
  return { accept: r.accept === true, submit: r.submit === true, recheck: r.recheck === true, release: r.release === true, expire: r.expire === true };
}

function mapSubmission(r: Row): Submission {
  return { url: str(r.url), mask: mask(r.mask), fp: fp(r.fp), at: secs(r.at) };
}

export function mapBrief(r: Row, id = ""): Brief {
  const role = str(r.role);
  const requirements = Array.isArray(r.requirements) ? r.requirements.map((x) => str(x)) : [];
  return {
    id: str(r.brief ?? id),
    sponsor: addr(r.sponsor),
    creator: addr(r.creator),
    postPrefix: str(r.post_prefix),
    requirements,
    of: num(r.of, Math.max(0, requirements.length - 1)),
    feeAtto: atto(r.fee),
    publishBy: secs(r.publish_by),
    submitCloses: secs(r.submit_closes),
    holdSeconds: num(r.hold_seconds),
    status: status(r.status),
    openedAt: secs(r.opened_at),
    acceptedAt: secs(r.accepted_at),
    closedAt: secs(r.closed_at),
    tries: num(r.tries),
    submissions: rowsOf(r.submissions).map(mapSubmission),
    url: str(r.url),
    mask: mask(r.mask),
    met: num(r.met),
    heldAtto: atto(r.held),
    owedAtto: atto(r.owed),
    holdUntil: secs(r.hold_until),
    toCreatorAtto: atto(r.to_creator),
    toSponsorAtto: atto(r.to_sponsor),
    feesToSponsorAtto: atto(r.fees_to_sponsor),
    rechecks: num(r.rechecks),
    recheckedAt: secs(r.rechecked_at),
    up: str(r.up),
    submitFeeAtto: atto(r.submit_fee),
    now: secs(r.now),
    can: mapCan(r.can),
    role: role === "sponsor" || role === "creator" ? role : undefined,
  };
}

export function mapStats(r: Row): Stats {
  return {
    briefs: num(r.briefs),
    offered: num(r.offered),
    accepted: num(r.accepted),
    heldBriefs: num(r.held_briefs),
    released: num(r.released),
    takenDown: num(r.taken_down),
    hiddenAds: num(r.hidden_ads),
    nothingMet: num(r.nothing_met),
    declined: num(r.declined),
    withdrawn: num(r.withdrawn),
    expired: num(r.expired),
    submits: num(r.submits),
    clear: num(r.clear),
    unclear: num(r.unclear),
    resubmits: num(r.resubmits),
    rechecks: num(r.rechecks),
    heldAtto: atto(r.held),
    takenAtto: atto(r.taken),
    toCreatorsAtto: atto(r.to_creators),
    toSponsorsAtto: atto(r.to_sponsors),
    feesToSponsorsAtto: atto(r.fees_to_sponsors),
    creditAtto: atto(r.credit),
    depositedAtto: atto(r.deposited),
    creditWithdrawnAtto: atto(r.credit_withdrawn),
    refusedPayments: num(r.refused_payments),
    returnedAtto: atto(r.returned),
  };
}

const paged = <T>(value: Row, map: (r: Row) => T): Paged<T> => {
  if (!Array.isArray(value.rows)) throw new Error(NETWORK_ERROR);
  return { total: num(value.total), offset: num(value.offset), limit: num(value.limit, PAGE), rows: rowsOf(value.rows).map(map) };
};

// ---- reads: one function per view ---------------------------------------------------------------------

type Fresh = { fresh?: boolean };
const pageArgs = (offset: number, limit: number): [number, number] => [Math.max(0, Math.trunc(offset)), Math.max(1, Math.min(PAGE, Math.trunc(limit)))];

/** brief(id): null when the contract holds no such brief. Its row carries the view's own clock and what may be called now. */
export async function readBrief(id: string, opts: Fresh = {}): Promise<ReadResult<Brief | null>> {
  const value = asRow(await view("brief", [id], opts));
  if ("error" in value || !value.sponsor) return result(null);
  return result(mapBrief(value, id));
}

/** briefs(offset, limit): one page of every brief, oldest first. */
export async function readBriefs(offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Brief>>> {
  return result(paged(asRow(await view("briefs", pageArgs(offset, limit), opts)), (r) => mapBrief(r)));
}

/** briefs_of(address, offset, limit): one page of the briefs an address is a party to, as sponsor or creator. */
export async function readBriefsOf(address: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Brief>>> {
  return result(paged(asRow(await view("briefs_of", [address.toLowerCase(), ...pageArgs(offset, limit)], opts)), (r) => mapBrief(r)));
}

/** The newest rows of a paged list first: the first page says how many there are, then the newest pages down to `maxPages`. */
async function newestFirst(read: (offset: number) => Promise<Paged<Brief>>, maxPages: number): Promise<{ total: number; rows: Brief[]; partial: boolean }> {
  const first = await read(0);
  const pages = Math.ceil(first.total / PAGE);
  const rows = [...first.rows];
  for (let p = pages - 1, k = 1; p >= 1 && k < maxPages; p--, k++) rows.push(...(await read(p * PAGE)).rows);
  const unique = new Map(rows.map((r) => [r.id, r]));
  return { total: first.total, rows: [...unique.values()].sort((a, b) => idNumber(b.id) - idNumber(a.id)), partial: pages > maxPages };
}

export async function readBriefsWindow(maxPages = 3, opts: Fresh = {}): Promise<ReadResult<{ total: number; rows: Brief[]; partial: boolean }>> {
  return result(await newestFirst(async (o) => (await readBriefs(o, PAGE, opts)).data, maxPages));
}

export async function readBriefsOfWindow(address: string, maxPages = 3, opts: Fresh = {}): Promise<ReadResult<{ total: number; rows: Brief[]; partial: boolean }>> {
  return result(await newestFirst(async (o) => (await readBriefsOf(address, o, PAGE, opts)).data, maxPages));
}

/** credit(address): an address's credit for submit fees. */
export async function readCredit(address: string, opts: Fresh = {}): Promise<ReadResult<Credit>> {
  const r = asRow(await view("credit", [address.toLowerCase()], opts));
  if ("error" in r) throw new Error(NETWORK_ERROR);
  return result({ address: addr(r.address), creditAtto: atto(r.credit), submitFeeAtto: atto(r.submit_fee), submissions: num(r.submissions) });
}

/** stats(): the contract's totals. */
export async function readStats(opts: Fresh = {}): Promise<ReadResult<Stats>> {
  return result(mapStats(asRow(await view("stats", [], opts))));
}

/** rules(): the contract's own words for its askings, its windows, who may do what and where the money goes. */
export async function readRules(): Promise<ReadResult<Rules>> {
  return result(asRow(await view("rules", [])));
}

// ---- writes ----------------------------------------------------------------------------------------------

/** True for the calls the validators settle by fetching the post: the rail then shows their votes. */
export const isJudged = (fn: WriteFn) => fn === "submit" || fn === "recheck";

const WRONG_CHAIN = (chainId: number | null) => `Your wallet is on ${chainName(chainId)}. Switch it to GenLayer Studio (chain 61999) before signing.`;

/** Sends a call through the connected EIP-1193 provider. Resolves to the transaction hash. */
export async function write(call: Call): Promise<string> {
  if (isMock) return mock.write(call);
  const address = contractAddress();
  if (!address) throw new Error("The contract is not deployed yet, so there is nothing to sign.");
  const signer = getSigner();
  if (!signer) throw new Error("Connect a wallet first.");
  // Studio is gasless and the SDK skips its own chain check for it, so the refusal to sign on another
  // chain lives here, and it says which chain the wallet is on.
  const chainId = await getChainId(signer.provider);
  if (chainId !== CHAIN_ID) throw new Error(WRONG_CHAIN(chainId));
  const client = createClient({ chain: studio, account: signer.address as Address, provider: signer.provider });
  const hash = await client.writeContract({
    address: address as Address,
    functionName: call.fn,
    args: call.args,
    value: call.value ?? 0n,
  });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("The wallet returned no transaction hash.");
  return hash;
}

// ---- outcomes: what a finished call's JSON return means ---------------------------------------------

/**
 * True when the leader's return is what the chain stored. A round with no majority, a cancelled tx or one
 * the validators did not accept still carries the leader's JSON, but nothing of it was kept.
 */
export const stored = (s: TxStatus | null): s is TxStatus => !!s && !s.undetermined && s.applied !== false && s.status !== "CANCELED";

/** The tag of a raised error: a rule ([EXPECTED]), a page that could not be read ([TRANSIENT]) or a model failure ([LLM_ERROR]). */
export function errorTag(s: TxStatus | null): "EXPECTED" | "TRANSIENT" | "LLM_ERROR" | "" {
  const m = /\[(EXPECTED|TRANSIENT|LLM_ERROR)\]/.exec(s?.message || "");
  return m ? (m[1] as "EXPECTED" | "TRANSIENT" | "LLM_ERROR") : "";
}

/** The sentence after a raised error's tag, as a sentence; "" when there is none. */
function raisedSentence(s: TxStatus): string {
  const m = /\[(?:EXPECTED|TRANSIENT|LLM_ERROR)\]\s*([^"}\n]+)/.exec(s.message || "");
  return m ? sentence(m[1]) : "";
}

/** The contract's reason for refusing a call, as a sentence; "" when the call was not refused. */
export function refusalReason(s: TxStatus | null): string {
  if (!s) return "";
  const r = s.result;
  if (r && r.ok === false) return sentence(str(r.reason));
  if (s.exec === "ERROR" && !s.undetermined) return raisedSentence(s) || sentence(s.message || "");
  return "";
}

/** True when the transaction finished and the contract did what was asked. */
export function succeeded(s: TxStatus | null): boolean {
  return !!s && s.status === "FINALIZED" && stored(s) && s.exec !== "ERROR" && s.result?.ok !== false;
}

/**
 * A submission or a recheck whose round stored nothing because the post could not be read or a model
 * call failed: the leader raised and no validator agrees with a leader that raised.
 */
export function unsettledWhy(s: TxStatus | null): string {
  if (!s || !s.undetermined) return "";
  const tag = errorTag(s);
  if (tag === "TRANSIENT" || tag === "LLM_ERROR" || tag === "EXPECTED") return raisedSentence(s);
  return "";
}

/** A plain sentence for a tx that finished without doing what was asked; "" when it did. */
export function failureOf(s: TxStatus | null): string {
  if (!s) return "";
  if (s.undetermined) {
    const why = unsettledWhy(s);
    return why
      ? `${why} The validators did not agree on a value, so nothing was stored, no fee was taken and no money moved.`
      : "The validators did not reach a majority, so nothing was stored. Sending the same call again is safe.";
  }
  if (s.status === "CANCELED") return "The network cancelled the transaction. Nothing was stored.";
  const reason = refusalReason(s);
  if (reason) return reason;
  if (s.applied === false) return "The validators did not accept this transaction. Nothing was stored.";
  return "";
}

const ok = (s: TxStatus | null): s is TxStatus & { result: Row } => stored(s) && s.result?.ok === true;

export type Paid = { kind: "done"; result: Row } | { kind: "refused"; reason: string; returnedAtto: string } | { kind: "unknown" };

/** open_brief()'s or deposit()'s return: taken, or refused with what came back in the same transaction. */
export function paidOutcome(s: TxStatus | null): Paid {
  if (!stored(s) || !s.result) return { kind: "unknown" };
  if (s.result.ok === true) return { kind: "done", result: s.result };
  if (s.result.ok === false) return { kind: "refused", reason: sentence(str(s.result.reason)), returnedAtto: atto(s.result.returned) };
  return { kind: "unknown" };
}

/** open_brief()'s return: the new brief's id, or "". */
export const openedBrief = (s: TxStatus | null): string => {
  const p = paidOutcome(s);
  return p.kind === "done" && /^B\d+$/.test(str(p.result.brief)) ? str(p.result.brief) : "";
};

export type Reading = { mask: string; fp: string; url: string; met: number; of: number; status: BriefStatus; owedAtto: string; toSponsorAtto: string; holdUntil: number; fee: string; tries: number };

/** submit()'s return: the agreed mask (or "unclear") and where the money went. */
export function readingOutcome(s: TxStatus | null): Reading | null {
  if (!ok(s) || !mask(s.result.mask)) return null;
  const r = s.result;
  return {
    mask: mask(r.mask),
    fp: fp(r.fp),
    url: str(r.url),
    met: num(r.met),
    of: num(r.of),
    status: status(r.status),
    owedAtto: atto(r.owed),
    toSponsorAtto: atto(r.to_sponsor),
    holdUntil: secs(r.hold_until),
    fee: str(r.fee),
    tries: num(r.try),
  };
}

/** recheck()'s return: whether the post was still up. */
export function recheckOutcome(s: TxStatus | null): { up: string; toSponsorAtto: string } | null {
  if (!ok(s) || (s.result.up !== "yes" && s.result.up !== "gone")) return null;
  return { up: str(s.result.up), toSponsorAtto: atto(s.result.to_sponsor) };
}

/** True when GEN moves to or from somebody because of this call, so balances are watched afterwards. */
export function movesMoney(s: TxStatus): boolean {
  const r = s.result;
  if (!r) return false;
  if (r.ok === false) return atto(r.returned) !== "0";
  if (r.ok !== true) return false;
  return atto(r.to_creator) !== "0" || atto(r.to_sponsor) !== "0" || atto(r.withdrawn) !== "0" || r.fee === "to_sponsor";
}

// ---- the demo creator ------------------------------------------------------------------------------

let demoCache: { at: number; value: DemoStatus } | null = null;

/** Whether the demo creator can act now, its address and its site. Asked of the site's own server; cached a minute. */
export async function readDemoStatus(): Promise<DemoStatus> {
  if (isMock) return mock.demoStatus();
  if (demoCache && Date.now() - demoCache.at < 60_000) return demoCache.value;
  try {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    const body = (await res.json()) as Partial<DemoStatus>;
    const creator = /^0x[0-9a-f]{40}$/.test(addr(body.creator)) ? addr(body.creator) : demoCreatorFallback();
    const value: DemoStatus = {
      online: body.online === true,
      creator,
      reason: str(body.reason),
      posts: body.posts === true,
      postsReason: str(body.postsReason),
      prefix: str(body.prefix),
    };
    demoCache = { at: Date.now(), value };
    return value;
  } catch {
    return { online: false, creator: demoCreatorFallback(), reason: "the site's server did not answer", posts: false, postsReason: "", prefix: "" };
  }
}

async function askDemo(path: string, body: Record<string, string>): Promise<DemoAnswer> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const answer = (await res.json()) as Record<string, unknown>;
    if (answer.ok === true && typeof answer.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(answer.hash)) {
      const deposit = typeof answer.deposit === "string" && /^0x[0-9a-fA-F]{64}$/.test(answer.deposit) ? answer.deposit : undefined;
      return deposit ? { ok: true, hash: answer.hash, deposit } : { ok: true, hash: answer.hash };
    }
    return { ok: false, reason: sentence(str(answer.reason, "the demo creator did not answer")), retryAfter: num(answer.retryAfter) || undefined };
  } catch {
    return { ok: false, reason: "The site's server did not answer. Try again in a minute." };
  }
}

/** Asks the demo creator to accept a brief made to it. */
export async function requestDemoAccept(brief: string): Promise<DemoAnswer> {
  if (isMock) return mock.demoAccept(brief);
  return askDemo("/api/demo/accept", { brief });
}

/** Asks the demo creator to submit one of its four fixed posts. Nothing the visitor types goes with it. */
export async function requestDemoPost(brief: string, page: string): Promise<DemoAnswer> {
  if (isMock) return mock.demoPost(brief, page);
  return askDemo("/api/demo/post", { brief, page });
}

// ---- transactions, balances, the faucet -------------------------------------------------------------

/** One poll of a transaction. Pages call this every 3 s until it is final. */
export async function txStatus(hash: string): Promise<TxStatus> {
  if (isMock) return mock.txStatus(hash);
  // Two quick tries: the caller polls anyway. eth_* has its own bucket and its own retry budget.
  const tx = await withRetry(() => rpc<RawTx | null>("eth_getTransactionByHash", [hash]), { tries: 2, bucket: "eth", ownBudget: true });
  return decodeTx(tx);
}

/** Balance in atto of an address (eth_getBalance). */
export async function balanceOf(address: string): Promise<bigint> {
  if (isMock) return mock.balanceOf(address);
  const hex = await withRetry(() => rpc<string>("eth_getBalance", [address, "latest"]), { tries: 3, bucket: "eth", ownBudget: true });
  return BigInt(hex || "0x0");
}

const FAUCET_PAUSE_MS = 10_000;
const FAUCET_TRIES = 3;
const FAUCET_WAIT_MS = 60_000;

/**
 * Faucet: sim_fundAccount with 10 GEN, up to three tries ten seconds apart, each after the gen_call
 * cooldown. Resolves when the balance moved. `stillWanted` is asked between balance polls: once it says
 * no (the wallet switched accounts) the wait ends with an error nobody shows.
 */
export async function faucet(address: string, opts: { stillWanted?: () => boolean } = {}): Promise<bigint> {
  if (isMock) return mock.faucet(address);
  // Studio credits only a checksummed address: the lowercase spelling is accepted and never paid.
  let account: string;
  try {
    account = getAddress(address);
  } catch {
    throw new Error("That is not a valid 0x address, so the faucet was not asked.");
  }
  let before: bigint;
  try {
    before = await balanceOf(account);
  } catch {
    throw new Error("Could not read this wallet's balance from Studio, so the faucet was not asked. Try again in a few seconds.");
  }
  let sent = false;
  for (let i = 0; i < FAUCET_TRIES && !sent; i++) {
    await waitForCooldown("gen");
    try {
      // `amount` is wei as a JS number; a decimal string makes the node compare str with int.
      await rpc("sim_fundAccount", { account_address: account, amount: 10e18 });
      sent = true;
    } catch (e) {
      noteFailure(e, Date.now(), "gen");
      if (i === FAUCET_TRIES - 1) throw new Error(FAUCET_REFUSED);
      await sleep(FAUCET_PAUSE_MS);
    }
  }
  const started = Date.now();
  while (Date.now() - started < FAUCET_WAIT_MS) {
    await sleep(2000);
    if (opts.stillWanted && !opts.stillWanted()) throw new Error("The faucet wait ended: the wallet switched accounts.");
    try {
      const now = await balanceOf(account);
      if (now !== before) return now;
    } catch {
      /* a dropped poll is not a failed faucet; keep polling */
    }
  }
  throw new Error("The faucet did not credit the account within 60 s. Try again.");
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const briefPath = (id: string) => `/brief/${id}`;
