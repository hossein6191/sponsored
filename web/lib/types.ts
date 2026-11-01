// The shapes the pages use, in one place with no runtime code: lib/chain.ts maps every view answer
// into these, and lib/chain-mock.ts answers in the contract's own JSON so the same mappers run in both
// modes. Every instant is seconds on the message clock, 0 until it happens; every amount is a decimal
// string of atto.

import type { BriefStatus } from "./rules.ts";

/** One reading of a submitted post: its address, the agreed mask (or "unclear") and its fingerprint. */
export type Submission = { url: string; mask: string; fp: string; at: number };

/** What may be called on a brief right now, by the view's own clock. */
export type Can = { accept: boolean; submit: boolean; recheck: boolean; release: boolean; expire: boolean };

/** brief(id): one brief, its lines (line 0 the disclosure), its terms, its readings and its money. */
export type Brief = {
  /** "B3" */
  id: string;
  sponsor: string;
  creator: string;
  postPrefix: string;
  /** every line, the disclosure first */
  requirements: string[];
  /** how many of them are the sponsor's own */
  of: number;
  feeAtto: string;
  publishBy: number;
  submitCloses: number;
  holdSeconds: number;
  status: BriefStatus;
  openedAt: number;
  acceptedAt: number;
  closedAt: number;
  tries: number;
  submissions: Submission[];
  /** the post the brief was settled on; "" before */
  url: string;
  /** its mask; "" before */
  mask: string;
  met: number;
  heldAtto: string;
  owedAtto: string;
  holdUntil: number;
  toCreatorAtto: string;
  toSponsorAtto: string;
  feesToSponsorAtto: string;
  rechecks: number;
  recheckedAt: number;
  /** the last recheck: "yes", "gone" or "" before any */
  up: string;
  submitFeeAtto: string;
  /** the view's own clock when it was read (only brief() carries it); 0 otherwise */
  now: number;
  can: Can | null;
  /** briefs_of(): the address's part in it */
  role?: "sponsor" | "creator";
};

export type Paged<T> = { total: number; offset: number; limit: number; rows: T[] };

export type Credit = { address: string; creditAtto: string; submitFeeAtto: string; submissions: number };

/** stats(): totals only. */
export type Stats = {
  briefs: number;
  offered: number;
  accepted: number;
  heldBriefs: number;
  released: number;
  takenDown: number;
  hiddenAds: number;
  nothingMet: number;
  declined: number;
  withdrawn: number;
  expired: number;
  submits: number;
  clear: number;
  unclear: number;
  resubmits: number;
  rechecks: number;
  heldAtto: string;
  takenAtto: string;
  toCreatorsAtto: string;
  toSponsorsAtto: string;
  feesToSponsorsAtto: string;
  creditAtto: string;
  depositedAtto: string;
  creditWithdrawnAtto: string;
  refusedPayments: number;
  returnedAtto: string;
};

/** rules(): the contract's own words, kept as it answers them. */
export type Rules = Record<string, unknown>;

export type ReadResult<T> = { data: T; source: "chain" | "mock" };

export type WriteFn = "open_brief" | "withdraw_brief" | "decline" | "accept" | "deposit" | "withdraw" | "submit" | "recheck" | "release" | "expire";

export type Arg = string | number | bigint | boolean;

/** One write: the method, its arguments in the contract's order, and the value sent with it. */
export type Call = { fn: WriteFn; args: Arg[]; value?: bigint };

export type Votes = { agree: number; disagree: number; idle: number };

/** One poll of a transaction, decoded (lib/rpc.ts decodeTx). */
export type TxStatus = {
  status: string;
  votes: Votes;
  applied: boolean | null;
  undetermined: boolean;
  exec: string | null;
  result: Record<string, unknown> | null;
  message: string;
};

/** GET /api/demo/status: whether the demo creator can act now, and exactly why not. */
export type DemoStatus = {
  online: boolean;
  /** the demo creator's public address, lowercase; "" when the server holds no usable key */
  creator: string;
  reason: string;
  /** true when the pinned addresses of the demo posts can be built */
  posts: boolean;
  postsReason: string;
  /** the demo creator's site: posts/ at the pinned commit, as a brief's post prefix; "" when it cannot be built */
  prefix: string;
};

export type DemoAnswer = { ok: true; hash: string; deposit?: string } | { ok: false; reason: string; retryAfter?: number };
