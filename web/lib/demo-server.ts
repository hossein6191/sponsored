// The demo creator, server side only (imported by app/api/demo/*). It holds a throwaway Studio test key
// from the DEMO_CREATOR_KEY environment variable and signs exactly three kinds of call with it, only on
// briefs made to it whose post prefix is its own site (posts/ of the public repository at the pinned
// commit): accept() on an offered brief; deposit() of a few submissions' worth of credit when its credit
// has run out; and submit() of ONE of the four fixed post addresses in lib/demo-creator.ts. The visitor
// only names the brief and which of the four posts; nothing a visitor types is ever signed. The key is
// never logged, never returned and never written anywhere; an answer names the creator's public address
// at most.

import { createAccount, createClient } from "genlayer-js";
import { getAddress, type Address } from "viem";

import { balanceOf, contractAddress, isMock, readBrief, readCredit, studio } from "./chain";
import { REPO_URL, postsCommit } from "./config";
import { cleanKey, keyProblem } from "./demo-key";
import { DEMO_LIMITS, createLimiter } from "./demo-limit";
import { demoProblem, isPostKey, postUrl, postsBase, prefixFits, repoOf } from "./demo-creator";
import { SUBMIT_FEE } from "./rules";
import { FINAL_STATUSES, rpc, sleep, statusName, type RawTx } from "./rpc";
import type { DemoStatus } from "./types";

type Account = ReturnType<typeof createAccount>;
let account: { key: string; value: Account } | null = null;

/** The demo creator's account, or null when no usable key is configured. */
function demoAccount(): Account | null {
  const raw = process.env.DEMO_CREATOR_KEY;
  if (keyProblem(raw)) return null;
  const key = cleanKey(raw);
  if (!account || account.key !== key) account = { key, value: createAccount(key as `0x${string}`) };
  return account.value;
}

export const NO_CONTRACT_REASON = "the contract is not deployed yet";
export const RPC_DOWN = "Studio's RPC did not answer; try again in a minute";
export const NO_BALANCE = "the demo creator's account holds no GEN and Studio's faucet did not top it up";
export const NO_COMMIT = "the demo posts are not pinned to a commit yet (POSTS_COMMIT in lib/config.ts, or NEXT_PUBLIC_POSTS_COMMIT)";
export const NO_REPO = "the site does not know its public repository (NEXT_PUBLIC_REPO_URL), so it cannot build the posts' addresses";
export const LONG_PREFIX = "the posts' pinned address is longer than the 120 characters a post prefix may have; use a shorter repository name";

/** What the demo creator deposits when its credit runs out: five submissions. */
export const DEMO_DEPOSIT = SUBMIT_FEE * 5n;

/** The demo creator's site, when its pinned address can be built: posts/ at the pinned commit. */
export function postsState(): { posts: boolean; postsReason: string; prefix: string } {
  const commit = postsCommit();
  if (!commit) return { posts: false, postsReason: NO_COMMIT, prefix: "" };
  const repo = repoOf(REPO_URL);
  if (!repo) return { posts: false, postsReason: NO_REPO, prefix: "" };
  const prefix = postsBase(repo, commit);
  if (!prefixFits(prefix)) return { posts: false, postsReason: LONG_PREFIX, prefix: "" };
  return { posts: true, postsReason: "", prefix };
}

/** The demo key signs from its own balance; Studio's faucet refills it when it holds less than a GEN. */
async function ensureBalance(creator: string): Promise<boolean> {
  const have = await balanceOf(creator);
  if (have >= 10n ** 18n) return true;
  try {
    await rpc("sim_fundAccount", { account_address: getAddress(creator), amount: 20e18 });
  } catch {
    return have > 0n;
  }
  for (let i = 0; i < 6; i++) {
    await sleep(2000);
    try {
      if ((await balanceOf(creator)) > have) return true;
    } catch {
      /* one dropped read; ask again */
    }
  }
  return have > 0n;
}

/** Whether the demo creator can act now, and exactly why not. */
export async function demoStatusNow(): Promise<DemoStatus> {
  const posts = postsState();
  if (isMock) return { online: false, creator: "", reason: "in the demo build the demo creator answers in the browser", ...posts };
  const problem = keyProblem(process.env.DEMO_CREATOR_KEY);
  if (problem) return { online: false, creator: "", reason: problem, ...posts };
  const creator = demoAccount()!.address.toLowerCase();
  if (!contractAddress()) return { online: false, creator, reason: NO_CONTRACT_REASON, ...posts };
  let funded = false;
  try {
    funded = await ensureBalance(creator);
  } catch {
    return { online: false, creator, reason: RPC_DOWN, ...posts };
  }
  if (!funded) return { online: false, creator, reason: NO_BALANCE, ...posts };
  return { online: true, creator, reason: "", ...posts };
}

const limiter = createLimiter(DEMO_LIMITS);

// One move at a time per brief: the hash of the last one, until it is final.
const inflight = new Map<string, { hash: string; at: number }>();

/** True while the demo creator's last move on `brief` is still going through. */
async function stillMoving(brief: string): Promise<boolean> {
  const last = inflight.get(brief);
  if (!last) return false;
  if (Date.now() - last.at > DEMO_LIMITS.sentHoldMs) {
    inflight.delete(brief);
    return false;
  }
  try {
    const tx = await rpc<RawTx | null>("eth_getTransactionByHash", [last.hash]);
    if (tx && FINAL_STATUSES.has(statusName(tx.status))) {
      inflight.delete(brief);
      return false;
    }
  } catch {
    /* not readable now: still moving, as far as anyone can tell */
  }
  return true;
}

/** Waits until a transaction is accepted or final (its state applied), at most `ms`. */
async function landed(hash: string, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await sleep(3000);
    try {
      const tx = await rpc<RawTx | null>("eth_getTransactionByHash", [hash]);
      const s = statusName(tx?.status);
      if (s === "ACCEPTED" || s === "FINALIZED") return true;
      if (s === "CANCELED" || s === "UNDETERMINED") return false;
    } catch {
      /* a dropped poll; ask again */
    }
  }
  return false;
}

// One signature at a time: two moves signed at once would ask for the same nonce.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export type ServerAnswer = {
  status: number;
  body: { ok: true; hash: string; deposit?: string } | { ok: false; reason: string; retryAfter?: number; deposit?: string };
};

/**
 * The demo creator accepts a brief (`"accept"`) or submits one of its four fixed posts (a post key), on a
 * brief made to it whose post prefix is its own pinned site.
 */
export async function sendDemo(brief: string, what: string): Promise<ServerAnswer> {
  if (what !== "accept" && !isPostKey(what)) return { status: 400, body: { ok: false, reason: "the demo creator does only what its buttons say" } };
  const s = await demoStatusNow();
  if (!s.online) return { status: 503, body: { ok: false, reason: "the demo creator is offline: " + s.reason } };
  if (!s.posts) return { status: 503, body: { ok: false, reason: "the demo creator is waiting: " + s.postsReason } };
  const turn = limiter.attempt(brief, Date.now());
  if (!turn.ok) return { status: 429, body: { ok: false, reason: `the demo creator was asked about ${brief} a moment ago; try again in ${turn.retryAfter} s`, retryAfter: turn.retryAfter } };
  if (await stillMoving(brief)) return { status: 409, body: { ok: false, reason: `the demo creator is still waiting for its last move on ${brief} to be final; try again once it is` } };
  let row;
  try {
    row = (await readBrief(brief, { fresh: true })).data;
  } catch {
    return { status: 502, body: { ok: false, reason: "could not read the brief from Studio; try again in a minute" } };
  }
  const problem = demoProblem(row ? { id: row.id, creator: row.creator, postPrefix: row.postPrefix, status: row.status, can: row.can } : null, s.creator, s.prefix, what);
  if (problem) return { status: row ? 409 : 404, body: { ok: false, reason: problem } };
  const a = demoAccount()!;
  const client = createClient({ chain: studio, account: a });
  const sign = (functionName: string, args: string[], value = 0n) =>
    serial(async () => {
      const hash = await client.writeContract({ address: contractAddress() as Address, functionName, args, value });
      if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("no hash");
      return hash;
    });
  try {
    if (what === "accept") {
      const hash = await sign("accept", [brief]);
      inflight.set(brief, { hash, at: Date.now() });
      return { status: 200, body: { ok: true, hash } };
    }
    // A submission takes its fee from credit deposited beforehand: when the credit has run out, the
    // demo creator deposits five submissions' worth and waits for that to land before it submits.
    let deposit: string | undefined;
    const have = BigInt((await readCredit(s.creator, { fresh: true })).data.creditAtto);
    if (have < SUBMIT_FEE) {
      deposit = await sign("deposit", [], DEMO_DEPOSIT);
      if (!(await landed(deposit, 40_000)))
        return { status: 202, body: { ok: false, reason: "the demo creator topped up its credit for submissions and is waiting for it to land; press the button again in a minute", deposit } };
    }
    // The button picks which of the four fixed posts; its pinned address is what is signed.
    const hash = await sign("submit", [brief, postUrl(repoOf(REPO_URL), postsCommit(), what)]);
    inflight.set(brief, { hash, at: Date.now() });
    return { status: 200, body: deposit ? { ok: true, hash, deposit } : { ok: true, hash } };
  } catch {
    // Nothing of the error goes out: it is the network's, and it is not the visitor's business.
    return { status: 502, body: { ok: false, reason: "Studio did not take the demo creator's move; try again in a minute" } };
  }
}
