// One-click suggestions for every field of the site, each one inside the contract's limits (tests/unit/
// suggestions.test.mjs checks every chip against lib/rules.ts). A chip fills its field; nothing is sent
// until the visitor signs. Every brand, blog and address here is fictional.

import { DEMO_FEE_GEN, DEMO_LINES, DEMO_WINDOWS, POST_KEYS, postOf } from "./demo-creator.ts";
import { SUBMIT_FEE } from "./rules.ts";

export type Chip<T> = { label: string; value: T; tag?: string };

/** The demo lines as one chip: the three lines every demo post was written against. */
export const DEMO_LINES_CHIP: Chip<string[]> = { label: "The demo lines (Tidewell dry bag)", value: DEMO_LINES, tag: "3 lines" };

/** Single lines a sponsor might add, one check each. */
export const LINE_CHIPS: Chip<string>[] = [
  { label: "Names the bag", value: DEMO_LINES[0] },
  { label: "Writes out the link", value: DEMO_LINES[1] },
  { label: "Mentions orange", value: DEMO_LINES[2] },
  { label: "Says it floats", value: "Says that the bag floats when it falls in the water" },
  { label: "Mentions free returns", value: "Mentions that Tidewell offers free returns for 30 days" },
  { label: "Gives a discount code", value: "Gives the discount code HARBOUR10 written out in full" },
];

/** Fees in GEN, as typed in the fee field. */
export const FEE_CHIPS: Chip<string>[] = [
  { label: "0.3 GEN", value: "0.3" },
  { label: `${DEMO_FEE_GEN} GEN`, value: DEMO_FEE_GEN, tag: "demo" },
  { label: "1.5 GEN", value: "1.5" },
  { label: "5 GEN", value: "5" },
];

/** How long from now the post must be up by, in seconds. */
export const PUBLISH_CHIPS: Chip<number>[] = [
  { label: "30 minutes", value: DEMO_WINDOWS.publishSeconds, tag: "demo" },
  { label: "2 hours", value: 2 * 3600 },
  { label: "1 day", value: 86400 },
  { label: "7 days", value: 7 * 86400 },
];

/** How long the post must stay up before it is paid, in seconds. */
export const HOLD_CHIPS: Chip<number>[] = [
  { label: "10 minutes", value: DEMO_WINDOWS.holdSeconds, tag: "demo" },
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86400 },
  { label: "7 days", value: 7 * 86400 },
];

/** Deposits of credit for submit fees, in GEN. */
export const DEPOSIT_CHIPS: Chip<string>[] = [
  { label: "1 submission", value: "0.01", tag: "0.01 GEN" },
  { label: "2 submissions", value: "0.02", tag: "0.02 GEN" },
  { label: "5 submissions", value: "0.05", tag: "0.05 GEN" },
];
export const DEPOSIT_UNIT = SUBMIT_FEE;

/** Example creator sites (post prefixes), beside the demo creator's own. */
export const PREFIX_CHIPS: Chip<string>[] = [
  { label: "moss-and-kettle.example/posts/", value: "https://moss-and-kettle.example/posts/" },
  { label: "blog.fernwood.example/", value: "https://blog.fernwood.example/" },
];

/** Example creator addresses for "any address": fictional, for trying the form. */
export const CREATOR_CHIPS: Chip<string>[] = [{ label: "A fictional creator", value: "0x7c2e4a6f81b3d5a7c9e0f2a4b6d8c0e1f3a5b7c9", tag: "nobody holds its key" }];

/**
 * Post addresses for the submit field of one brief: the four demo posts when the prefix holds them (the
 * demo creator's site, or any site in the demo build), otherwise two example pages below the prefix.
 */
export function urlChips(prefix: string, demoPosts: boolean): Chip<string>[] {
  if (!prefix) return [];
  if (demoPosts) return POST_KEYS.map((k) => ({ label: postOf(k).label, value: prefix + postOf(k).file, tag: postOf(k).file }));
  return [
    { label: "A review post", value: prefix + "tidewell-dry-bag-review" },
    { label: "A picnic post", value: prefix + "boat-picnic" },
  ];
}
