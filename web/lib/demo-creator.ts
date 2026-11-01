// The demo creator and the four posts it can submit, so one visitor's wallet can try everything as the
// sponsor.
//
// The demo creator is a throwaway Studio key the site's server holds (DEMO_CREATOR_KEY). It writes the
// fictional food-and-outdoors blog Harbour Eats, whose site is the repository's posts/ folder, pinned to
// one commit on raw.githubusercontent.com so every validator fetches the same bytes. A visitor opens a
// brief to it with their own wallet; the demo creator accepts it, and when the visitor presses one of
// the "What the creator posts" buttons it submits that one FIXED post. Nothing the visitor types ever
// passes through it: the brief only says which brief, and the button only says which of the four
// posts. Every brand, blog and person here is fictional. Pure, so node runs it in tests/unit.

import { DISCLOSURE, MAX_PREFIX, owedOf } from "./rules.ts";

export const DEMO_CREATOR_NAME = "Harbour Eats";
export const DEMO_HANDLE = "@harbour.eats";
export const DEMO_SPONSOR_NAME = "Tidewell";

/** The sponsor's three demo lines, as the contract's own tests and the on-chain run use them. */
export const DEMO_LINES = ["Mentions the Tidewell 20 L dry bag by name", "Links to tidewell.example/bags", "Mentions that the bag comes in orange"];

/** The demo windows: publish within 30 minutes, keep the post up 10 minutes before it is paid. */
export const DEMO_WINDOWS = { publishSeconds: 1800, holdSeconds: 600 };

/** The demo fee: 0.3 GEN for each of the three lines. */
export const DEMO_FEE_GEN = "0.9";

export type PostKey = "full" | "no-disclosure" | "no-link" | "wrong-product";
export const POST_KEYS: PostKey[] = ["full", "no-disclosure", "no-link", "wrong-product"];

/** What a reading settles into. */
export type Outcome = "held-all" | "held-part" | "hidden_ad" | "nothing_met";

export type DemoPost = {
  key: PostKey;
  file: string;
  /** the button */
  label: string;
  /** what the post does, in one line */
  says: string;
  /** the mask the network should agree on against the three demo lines, line 0 first */
  mask: string;
  outcome: Outcome;
  /** what that means for the money, in one line */
  money: string;
  /**
   * The first 16 hex characters of the sha256 of the post's visible text, as the contract fingerprints
   * it (tests/unit/demo.test.mjs recomputes it from posts/). On chain every validator fingerprints what
   * it fetched itself.
   */
  fp: string;
  /** the post as a reader sees it, for the phone frame: its heading and its paragraphs, word for word */
  heading: string;
  paragraphs: string[];
};

const INTRO =
  "Every summer we row out to the sandbar with a picnic, and every summer something gets wet. This year the bread, the cheese and the camera rode in the Tidewell 20 L dry bag, and all of it came back dry.";
const DETAIL =
  "The Tidewell 20 L dry bag rolls shut at the top and clips into a handle. It held lunch for four, a towel and a spare jumper, and it floated when a wave knocked it over the side.";
const ORANGE = "The bag comes in orange, so it was easy to spot on the water.";
const LINK = "You can find it at tidewell.example/bags.";
const SAID = "This post is sponsored by Tidewell.";
const PICNIC = "Harbour Eats: the boat picnic that stayed dry";

/** The four posts in posts/, in the order of their buttons. */
export const DEMO_POSTS: DemoPost[] = [
  {
    key: "full",
    file: "full.html",
    label: "The full post",
    says: "says it is sponsored, names the bag, writes out the link and mentions orange",
    mask: "1111",
    outcome: "held-all",
    money: "the whole fee is held for the creator, then paid when the hold ends",
    fp: "485e8e86e78b898e",
    heading: PICNIC,
    paragraphs: [SAID, INTRO, DETAIL, ORANGE, LINK],
  },
  {
    key: "no-disclosure",
    file: "no-disclosure.html",
    label: "The same post, no #ad",
    says: "the same post without the line that says it is sponsored",
    mask: "0111",
    outcome: "hidden_ad",
    money: "a hidden ad: the whole fee goes back to the sponsor and the brief closes",
    fp: "9050c6fda631d05b",
    heading: PICNIC,
    paragraphs: [INTRO, DETAIL, ORANGE, LINK],
  },
  {
    key: "no-link",
    file: "no-link.html",
    label: "Disclosed, no link",
    says: "says it is sponsored, names the bag and mentions orange, but never writes out the link",
    mask: "1101",
    outcome: "held-part",
    money: "two thirds are held for the creator; a third goes back to the sponsor at once",
    fp: "5c9b16c3df07be7c",
    heading: PICNIC,
    paragraphs: [SAID, INTRO, DETAIL, ORANGE],
  },
  {
    key: "wrong-product",
    file: "wrong-product.html",
    label: "The wrong bag",
    says: "says it is sponsored, but is about the Tidewell 10 L bag, in grey",
    mask: "1000",
    outcome: "nothing_met",
    money: "disclosed, but no line met: the whole fee goes back to the sponsor",
    fp: "f2088afa5bcedbcf",
    heading: "Harbour Eats: a small bag for the harbour walk",
    paragraphs: [
      SAID,
      "On Sunday mornings we walk the harbour wall to the bakery, and the rolls used to come home damp from the sea spray. This month they rode in the Tidewell 10 L dry bag, and they came home dry.",
      "The Tidewell 10 L dry bag is the small one: it fits six rolls and a flask, and it hangs from one shoulder.",
      "The bag comes in grey.",
    ],
  },
];

export const postOf = (key: PostKey): DemoPost => DEMO_POSTS.find((p) => p.key === key)!;
export const isPostKey = (what: string): what is PostKey => (POST_KEYS as string[]).includes(what);

/** "owner/name" from a GitHub repository URL; "" when it is not one. */
export function repoOf(url: string): string {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9-]+\/[A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(String(url ?? "").trim());
  return m ? m[1] : "";
}

/** The demo creator's site: posts/ at one commit, as raw.githubusercontent.com serves it. */
export const postsBase = (repo: string, commit: string): string => `https://raw.githubusercontent.com/${repo}/${commit}/posts/`;

/** The pinned address of one post. */
export const postUrl = (repo: string, commit: string, key: PostKey): string => postsBase(repo, commit) + postOf(key).file;

/** The demo post an address names, read from its last segment below posts/; null for any other address. */
export function postOfUrl(url: string): DemoPost | null {
  const m = /\/posts\/([a-z-]+\.html)$/.exec(String(url ?? ""));
  if (!m) return null;
  return DEMO_POSTS.find((p) => p.file === m[1]) ?? null;
}

/** Whether a prefix can be a brief's post prefix at all: the contract takes at most MAX_PREFIX characters. */
export const prefixFits = (prefix: string): boolean => prefix.length > 0 && prefix.length <= MAX_PREFIX;

/**
 * What one demo post does against one line, as the demo expects: true met, false not met, null when the
 * line is not one the demo knows (the disclosure or one of the three demo lines).
 */
export function expectedLine(post: DemoPost, line: string): boolean | null {
  if (line === DISCLOSURE) return post.mask[0] === "1";
  const k = DEMO_LINES.indexOf(line);
  return k < 0 ? null : post.mask[k + 1] === "1";
}

/** The mask the network should reach for a post against a brief's lines (the disclosure first); null when a line is not a demo line. */
export function expectedMask(post: DemoPost, requirements: string[]): string | null {
  let mask = "";
  for (const line of requirements) {
    const met = expectedLine(post, line);
    if (met === null) return null;
    mask += met ? "1" : "0";
  }
  return mask;
}

/** What a mask settles into. */
export function outcomeOfMask(mask: string): Outcome {
  if (mask[0] !== "1") return "hidden_ad";
  const met = [...mask.slice(1)].filter((c) => c === "1").length;
  if (met === 0) return "nothing_met";
  return met === mask.length - 1 ? "held-all" : "held-part";
}

export const OUTCOME_WORDS: Record<Outcome, string> = {
  "held-all": "Every line met",
  "held-part": "Part met",
  hidden_ad: "Hidden ad",
  nothing_met: "Nothing met",
};

/** The creator's share and the sponsor's refund on a mask, as the contract works them out. */
export function splitOf(feeAtto: bigint, mask: string): { owed: bigint; back: bigint } {
  const owed = owedOf(feeAtto, mask);
  return { owed, back: feeAtto - owed };
}

export type DemoBriefView = { id: string; creator: string; postPrefix: string; status: string; can: { accept: boolean; submit: boolean } | null };

/**
 * Why the demo creator will not act on this brief now, in words a visitor can act on; "" when it will.
 * `what` is "accept" or one of the four post keys. The server asks this of a fresh read before it signs,
 * and so does the mock.
 */
export function demoProblem(b: DemoBriefView | null, demoCreator: string, prefix: string, what: string): string {
  if (!demoCreator) return "the demo creator is not set up on this site yet";
  if (what !== "accept" && !isPostKey(what)) return "the demo creator does only what its buttons say";
  if (!prefix) return "the demo posts are not pinned to a commit of the public repository yet, so the demo creator neither accepts nor posts";
  if (!b) return "there is no such brief";
  if (b.creator.toLowerCase() !== demoCreator.toLowerCase()) return `${b.id} is not a brief to the demo creator; only its own creator acts on it`;
  if (b.postPrefix !== prefix)
    return `${b.id}'s post prefix is not the demo creator's site (${prefix}), so the demo creator could never post below it; the sponsor can withdraw it and have the whole fee back`;
  if (what === "accept") {
    if (b.status !== "offered") return `${b.id} is ${b.status}; the demo creator accepts only an offered brief`;
    if (b.can && !b.can.accept) return `publish_by of ${b.id} has passed; a brief is accepted before it, and now only the sponsor can withdraw it`;
    return "";
  }
  if (b.status !== "accepted") return `${b.id} is ${b.status}; the demo creator posts only on an accepted brief`;
  if (b.can && !b.can.submit) return `${b.id} takes no more submissions: its window closed, or it had its submission and its one re-submission`;
  return "";
}

// ---- the scripted reader of mock mode -------------------------------------------------------------

export const FETCH_FAILED = "[TRANSIENT] the post could not be fetched; nothing was stored, no fee was taken, and it may be submitted again";

/**
 * What the in-memory contract of mock mode agrees on for a submitted post, in place of the validators:
 * a demo post's known answer for the disclosure and the three demo lines, and "unclear" when the brief
 * has any other line (on chain every validator asks its own model). Any other address cannot be fetched
 * and stores nothing.
 */
export function scriptedReading(url: string, requirements: string[]): { mask: string; fp: string } | { error: string } {
  const post = postOfUrl(url);
  if (!post) return { error: FETCH_FAILED };
  return { mask: expectedMask(post, requirements) ?? "unclear", fp: post.fp };
}
