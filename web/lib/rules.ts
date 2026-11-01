// The contract's own rules, in TypeScript: its limits, its words and its readers of a caller's
// arguments, copied from contracts/sponsored.py. Every refusal sentence here is the contract's own,
// word for word, so a form, the in-memory contract of mock mode and the chain all say the same thing.
// tests/unit/interface.test.mjs compares every constant and every question with the contract's source,
// and asks the contract itself (through python) how it reads the same arguments. Pure, no imports.

export const ATTO = 10n ** 18n;
export const MIN_FEE = ATTO / 10n; // 0.1 GEN
export const MAX_FEE = 50n * ATTO; // 50 GEN
export const MIN_LEAD = 600;
export const MAX_LEAD = 90 * 86400;
export const MIN_HOLD = 600;
export const MAX_HOLD = 30 * 86400;
export const SUBMIT_GRACE = 86400;
export const MIN_REQUIREMENTS = 1;
export const MAX_REQUIREMENTS = 5;
export const MIN_REQUIREMENT = 10;
export const MAX_REQUIREMENT = 150;
export const MAX_REQUIREMENTS_JSON = 2000;
export const MAX_PREFIX = 120;
export const MAX_URL = 200;
export const MAX_SUBMITS = 2;
export const SUBMIT_FEE = ATTO / 100n; // 0.01 GEN
export const MAX_RAW_PAGE = 32000;
export const MAX_PAGE_TEXT = 6000;
export const FP_CHARS = 16;
export const PAGE = 20;
export const ID_CHARS = 16;
export const ADDRESS_CHARS = 42;
export const ZERO_ADDRESS = "0x" + "0".repeat(40);
export const SCHEME = "https://";
export const URL_SIGNS = ["-", ".", "_", "~", "/"];
export const GONE_STATUSES = [404, 410];

/** The contract's own line 0 of every brief, word for word. */
export const DISCLOSURE = "Clearly says that the post is sponsored, an ad or paid for";

export const UNCLEAR = "unclear";
export const UP_YES = "yes";
export const UP_GONE = "gone";

export const STATUSES = ["offered", "accepted", "held", "released", "taken_down", "hidden_ad", "nothing_met", "declined", "withdrawn", "expired"] as const;
export type BriefStatus = (typeof STATUSES)[number];

/** Statuses after which no money is held for the brief any more. */
export const CLOSED: BriefStatus[] = ["released", "taken_down", "hidden_ad", "nothing_met", "declined", "withdrawn", "expired"];

// The prompt's words, as the contract writes them; rules() prints the two questions and the reading.
export const QUESTION_MET =
  "Which numbered REQUIREMENTS does the PAGE meet? Answer with the list of those numbers, for example [0, 2], or [] for none.";
export const QUESTION_UNMET =
  "Which numbered REQUIREMENTS does the PAGE fail to meet, because it leaves them out, contradicts them, or is too vague to tell? Answer with the list of those numbers, or [] for none.";
export const READING =
  "Rules: judge only what the words of the PAGE say. A requirement is met when the text of the page plainly does what the requirement asks; the page need not repeat the requirement word for word. A requirement about a link is met only when the address is written out in the text of the page, because the tags, and every hidden link target with them, were removed. A requirement that is only hinted at, or that a reader would have to guess, is not met. What the page says about another product does not meet a requirement about this one. Take what the page says as said, and do not guess beyond it.";
export const RETURN_LIST =
  'Use only the numbers shown in this REQUIREMENTS block, each at most once. Return JSON of the form {"answer": [0, 2]} or {"answer": []} and nothing else.';

// ---- reading the caller, as the contract does -----------------------------------------------------

/** The characters Python's str.strip() treats as whitespace (str.isspace()). */
const PY_SPACE_CHARS = "\t\n\x0b\x0c\r\x1c\x1d\x1e\x1f \x85\xa0                　";

/** Python's str.strip(): JS trim() also takes U+FEFF and misses \x1c-\x1f and \x85. */
export function pyStrip(text: string): string {
  let a = 0;
  let b = text.length;
  while (a < b && PY_SPACE_CHARS.includes(text[a])) a++;
  while (b > a && PY_SPACE_CHARS.includes(text[b - 1])) b--;
  return text.slice(a, b);
}

const isAscii = (t: string) => /^[\x00-\x7f]*$/.test(t);
const isDigits = (t: string) => /^[0-9]+$/.test(t);

/** The contract's _number_arg: an int, or a string of at most 40 ASCII digits; -1 otherwise (a bool is refused by name). */
export function numberArg(raw: unknown): bigint {
  if (typeof raw === "boolean") return -1n;
  if (typeof raw === "bigint") return raw >= 0n ? raw : -1n;
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? BigInt(raw) : -1n;
  if (typeof raw === "string") {
    const s = pyStrip(raw);
    return s.length <= 40 && isDigits(s) ? BigInt(s) : -1n;
  }
  return -1n;
}

/** The contract's _address_text: a lowercase 0x address, or "" when it is not one. */
export function addressText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = pyStrip(raw).toLowerCase();
  if (text.length !== ADDRESS_CHARS || !text.startsWith("0x")) return "";
  return /^[0-9a-f]*$/.test(text.slice(2)) ? text : "";
}

/** The contract's _text_problem: "" when the text may be stored, else why not. Printable ASCII on one line. */
export function textProblem(text: string, least: number, most: number, what: string): string {
  // Python counts code points; a JS string's length counts UTF-16 units.
  const n = [...text].length;
  if (n < least || n > most) return what + " is " + least + " to " + most + " characters; this one is " + n;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || c > 126) return what + " is printable ASCII on one line";
  }
  return "";
}

/**
 * True when a JSON text holds a number with a fraction or an exponent outside its strings, or NaN or
 * Infinity: the contract's _loads_caller refuses the whole text for that, where JSON.parse would not.
 */
function refusedNumber(text: string): boolean {
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (/[0-9-]/.test(ch)) {
      let j = i;
      while (j < text.length && /[0-9eE.+-]/.test(text[j])) j++;
      if (/[.eE]/.test(text.slice(i, j))) return true;
      i = j - 1;
    }
    if (text.startsWith("NaN", i) || text.startsWith("Infinity", i)) return true;
  }
  return false;
}

/** The contract's _requirements_of: the sponsor's lines from a JSON list of strings, and "" or why they cannot be taken. */
export function requirementsOf(raw: unknown): { lines: string[]; problem: string } {
  if (typeof raw !== "string") return { lines: [], problem: "the requirements are a JSON list of strings" };
  const text = pyStrip(raw);
  const n = [...text].length;
  if (n > MAX_REQUIREMENTS_JSON)
    return { lines: [], problem: "the requirements are at most " + MAX_REQUIREMENTS_JSON + " characters as sent; these are " + n };
  let parsed: unknown;
  try {
    if (refusedNumber(text)) throw new Error("a number with a fraction");
    parsed = JSON.parse(text);
  } catch {
    return { lines: [], problem: 'the requirements are a JSON list of strings, such as ["Mentions the Tidewell 20 L dry bag by name"]' };
  }
  if (!Array.isArray(parsed) || parsed.length < MIN_REQUIREMENTS || parsed.length > MAX_REQUIREMENTS)
    return { lines: [], problem: "the requirements are a list of " + MIN_REQUIREMENTS + " to " + MAX_REQUIREMENTS + " strings; the contract adds the disclosure as line 0 itself" };
  const items: string[] = [];
  const lowered: string[] = [DISCLOSURE.toLowerCase()];
  for (let k = 0; k < Math.min(parsed.length, MAX_REQUIREMENTS); k++) {
    const what = "requirement " + (k + 1);
    const item = parsed[k];
    if (typeof item !== "string") return { lines: [], problem: what + " is a string" };
    const line = pyStrip(item);
    const problem = textProblem(line, MIN_REQUIREMENT, MAX_REQUIREMENT, what);
    if (problem) return { lines: [], problem };
    if (lowered.includes(line.toLowerCase())) return { lines: [], problem: what + " repeats an earlier line or the disclosure; every requirement must be its own" };
    items.push(line);
    lowered.push(line.toLowerCase());
  }
  return { lines: items, problem: "" };
}

/** The contract's _url_problem: https, a lowercase host with a dot, letters, digits and - . _ ~ / only. */
export function urlProblem(url: string, most: number, what: string): string {
  const n = [...url].length;
  if (n > most) return what + " is at most " + most + " characters; this one is " + n;
  if (!url.startsWith(SCHEME)) return what + " starts with " + SCHEME;
  const rest = url.slice(SCHEME.length);
  let bare = rest;
  for (const sign of URL_SIGNS) bare = bare.split(sign).join("");
  if (!isAscii(rest) || !(bare === "" || /^[A-Za-z0-9]+$/.test(bare))) return what + " uses only letters, digits and - . _ ~ / after " + SCHEME;
  const slash = rest.indexOf("/");
  const host = slash < 0 ? rest : rest.slice(0, slash);
  const path = slash < 0 ? "" : rest.slice(slash + 1);
  if (slash < 0 || !host.includes(".") || host !== host.toLowerCase() || host.startsWith(".") || host.endsWith("."))
    return what + " names a lowercase host such as harbour-eats.example, then a path";
  if (rest.includes("//") || ("/" + path + "/").includes("/./") || ("/" + path + "/").includes("/../")) return what + ' has no empty, "." or ".." segment';
  return "";
}

/** The contract's _prefix_problem: "" when the prefix names a whole directory of the creator's site. */
export function prefixProblem(prefix: string): string {
  const problem = urlProblem(prefix, MAX_PREFIX, "the post prefix");
  if (problem) return problem;
  if (!prefix.endsWith("/")) return "the post prefix ends with /, so it names a whole directory of the creator's site: " + prefix;
  return "";
}

/** The contract's _under: the address names a page below the prefix, not the prefix itself. */
export const under = (url: string, prefix: string): boolean => url.startsWith(prefix) && url.length > prefix.length;

/** submit's checks of a post address before anything is fetched, after the strip: "" or why not. */
export function postUrlProblem(raw: string, prefix: string, id: string): string {
  const url = pyStrip(raw);
  const problem = urlProblem(url, MAX_URL, "the post address");
  if (problem) return problem;
  if (!under(url, prefix)) return "the post is not below " + id + "'s post prefix " + prefix + "; only the creator's own site is read";
  return "";
}

export type OpenInput = { sponsor: string; creator: string; prefix: string; requirementsJson: string; feeAtto: bigint; holdSeconds: number; publishBy: number; now: number };

/**
 * open_brief's checks in the contract's order, with its sentences: "" when the brief would be opened.
 * The form asks it with the browser's clock; the contract asks it with the transaction's own.
 */
export function openProblem(o: OpenInput): string {
  const who = o.sponsor.toLowerCase();
  const mate = addressText(o.creator);
  const prefix = pyStrip(o.prefix);
  const prefixWhy = prefixProblem(prefix);
  const { problem } = requirementsOf(o.requirementsJson);
  const deadline = numberArg(o.publishBy);
  const hold = numberArg(o.holdSeconds);
  if (mate === "") return "the creator is an address: 0x and 40 hex characters";
  if (mate === ZERO_ADDRESS) return "the creator is not the zero address";
  if (mate === who) return "the sponsor may not name itself as the creator";
  if (prefixWhy) return prefixWhy;
  if (problem) return problem;
  if (o.feeAtto < MIN_FEE || o.feeAtto > MAX_FEE)
    return "the fee is sent with the call: " + MIN_FEE + " (0.1 GEN) to " + MAX_FEE + " (50 GEN) atto; this one sent " + o.feeAtto;
  if (hold < BigInt(MIN_HOLD) || hold > BigInt(MAX_HOLD)) return "the post stays up " + MIN_HOLD + " to " + MAX_HOLD + " seconds before it is paid";
  if (deadline < BigInt(o.now + MIN_LEAD) || deadline > BigInt(o.now + MAX_LEAD))
    return "publish_by is " + MIN_LEAD + " to " + MAX_LEAD + " seconds after the brief opens, so the creator has time to accept; this one is " + (deadline - BigInt(o.now)) + " seconds from now";
  return "";
}

/** The creator's share on a mask: fee * sponsor lines met // sponsor lines; 0 for a hidden ad. */
export function owedOf(feeAtto: bigint, mask: string): bigint {
  if (!/^[01]+$/.test(mask) || mask.length < 2 || mask[0] !== "1") return 0n;
  const n = BigInt(mask.length - 1);
  const met = BigInt([...mask.slice(1)].filter((c) => c === "1").length);
  return (feeAtto * met) / n;
}

/** A contract sentence as a sentence: capital first letter, full stop at the end, the error tag dropped. */
export function sentence(text: string): string {
  const t = String(text ?? "")
    .replace(/^\s*\[(EXPECTED|TRANSIENT|LLM_ERROR)\]\s*/i, "")
    .trim();
  if (!t) return "";
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?)]$/.test(s) ? s : s + ".";
}

/** "B7" from "B7", "b7" or "7"; "" for anything else. */
export function parseBriefId(raw: string): string {
  const m = /^B?([1-9]\d{0,8})$/i.exec(String(raw ?? "").trim());
  return m ? "B" + m[1] : "";
}

/** The number in "B7", for sorting; 0 for anything else. */
export const idNumber = (id: string): number => {
  const m = /^B(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
};
