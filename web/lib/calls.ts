// One builder per write method of the contract: the method's name, its arguments in the contract's
// order, and the value sent. Pure, so tests/unit/interface.test.mjs checks every builder against the
// signatures in contracts/sponsored.py with no browser and no network.

import type { Call } from "./types.ts";
import { pyStrip } from "./rules.ts";

const int = (n: number): number => Math.trunc(n);

export const calls = {
  /**
   * open_brief(creator, post_prefix, requirements_json, publish_by, hold_seconds), payable: the fee is the
   * value sent. The sponsor's lines travel as one JSON list of strings; the contract adds line 0 itself.
   * A refused brief returns what was sent in the same transaction.
   */
  openBrief: (creator: string, postPrefix: string, lines: string[], publishBy: number, holdSeconds: number, feeAtto: bigint): Call => ({
    fn: "open_brief",
    args: [creator.trim().toLowerCase(), postPrefix.trim(), JSON.stringify(lines.map((l) => pyStrip(l))), int(publishBy), int(holdSeconds)],
    value: feeAtto,
  }),
  /** withdraw_brief(brief_id): the sponsor, while the brief is not accepted. */
  withdrawBrief: (brief: string): Call => ({ fn: "withdraw_brief", args: [brief] }),
  /** decline(brief_id): the creator, while the brief is not accepted. */
  decline: (brief: string): Call => ({ fn: "decline", args: [brief] }),
  /** accept(brief_id): the creator, before publish_by. */
  accept: (brief: string): Call => ({ fn: "accept", args: [brief] }),
  /** deposit(), payable: the value joins the sender's own credit, which pays submit fees. */
  deposit: (valueAtto: bigint): Call => ({ fn: "deposit", args: [], value: valueAtto }),
  /** withdraw(): the sender's whole credit back to the sender. */
  withdraw: (): Call => ({ fn: "withdraw", args: [] }),
  /** submit(brief_id, url): the creator; every validator reads the post on the live web in the same call. */
  submit: (brief: string, url: string): Call => ({ fn: "submit", args: [brief, url.trim()] }),
  /** recheck(brief_id): anyone, while the pay is held; one fetch of the same address, no model. */
  recheck: (brief: string): Call => ({ fn: "recheck", args: [brief] }),
  /** release(brief_id): anyone, once the hold has ended. */
  release: (brief: string): Call => ({ fn: "release", args: [brief] }),
  /** expire(brief_id): anyone, a day after publish_by, while no clear reading was made. */
  expire: (brief: string): Call => ({ fn: "expire", args: [brief] }),
};
