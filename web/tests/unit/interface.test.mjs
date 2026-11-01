// The site against the contract it talks to, read from contracts/sponsored.py in this repository: every
// write builder names a real write method with the right number of arguments and sends value only to the
// payable ones; every view the site reads exists and the site reads every view; the limits, the
// disclosure and the questions are the contract's own; every refusal sentence the in-memory contract and
// the forms give is made of the contract's words; the readers of a caller's arguments answer as the
// contract's do; and the in-memory rules() is the contract's rules(), compared whole.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calls } from "../../lib/calls.ts";
import * as rules from "../../lib/rules.ts";
import * as mock from "../../lib/chain-mock.ts";
import { askContract } from "./oracle.mjs";

// The contract's source with its escaped quotes read as quotes, and Python's adjacent string literals (a
// sentence split over two lines) joined back into one, so its sentences can be looked up whole.
const raw = readFileSync(new URL("../../../contracts/sponsored.py", import.meta.url), "utf8");
const contract = raw
  .replace(/\\"/g, '"')
  .replace(/"\s*\n\s*"/g, "")
  .replace(/"\s*\n\s*\+\s*"/g, "")
  .replace(/"\s*\+\s*\n\s*"/g, "")
  .replace(/" "/g, "");
const chainSource = readFileSync(new URL("../../lib/chain.ts", import.meta.url), "utf8");
const mockSource = readFileSync(new URL("../../lib/chain-mock.ts", import.meta.url), "utf8");
const rulesSource = readFileSync(new URL("../../lib/rules.ts", import.meta.url), "utf8");
const demoSource = readFileSync(new URL("../../lib/demo-creator.ts", import.meta.url), "utf8");

/** { name: { kind, payable, params: [names] } } for every public method of the contract. */
function methods() {
  const out = {};
  const re = /@gl\.public\.(write(?:\.payable)?|view)\s*\n\s*def (\w+)\(self(?:,\s*([^)]*))?\)/g;
  for (const m of raw.matchAll(re)) {
    const params = (m[3] ?? "")
      .split(",")
      .map((p) => p.trim().split(":")[0].trim())
      .filter(Boolean);
    out[m[2]] = { kind: m[1].startsWith("view") ? "view" : "write", payable: m[1].endsWith("payable"), params };
  }
  return out;
}

/** The value of a Python constant written as `NAME = <expr>` at the start of a line. */
const constant = (name) => {
  const m = new RegExp(`^${name}\\s*=\\s*([^#\\n]+)`, "m").exec(raw);
  assert.ok(m, `the contract defines ${name}`);
  return m[1].trim();
};

/** A parenthesised Python string constant, joined. */
const pyString = (name) => {
  const start = raw.indexOf(`\n${name} = (`);
  assert.ok(start >= 0, `the contract defines ${name}`);
  const body = raw.slice(start, raw.indexOf("\n)", start));
  return [...body.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)].map((m) => (m[1] ?? m[2]).replace(/\\"/g, '"')).join("");
};

test("every write builder names a write method of the contract, with its arguments in order and its value", () => {
  const all = methods();
  const built = [
    calls.openBrief("0x" + "a".repeat(40), "https://a.example/posts/", ["Mentions the bag by name"], 2_000_000_000, 600, 10n ** 18n),
    calls.withdrawBrief("B1"),
    calls.decline("B1"),
    calls.accept("B1"),
    calls.deposit(10n ** 16n),
    calls.withdraw(),
    calls.submit("B1", "https://a.example/posts/x"),
    calls.recheck("B1"),
    calls.release("B1"),
    calls.expire("B1"),
  ];
  const writes = Object.entries(all)
    .filter(([, m]) => m.kind === "write")
    .map(([n]) => n)
    .sort();
  assert.equal(writes.length, 10);
  assert.deepEqual([...new Set(built.map((c) => c.fn))].sort(), writes, "the site can send every write and nothing else");
  for (const c of built) {
    const m = all[c.fn];
    assert.equal(c.args.length, m.params.length, `${c.fn} takes ${m.params.length} arguments`);
    assert.equal(c.value !== undefined, m.payable, `${c.fn} sends value only when payable`);
  }
  assert.deepEqual(all.open_brief.params, ["creator", "post_prefix", "requirements_json", "publish_by", "hold_seconds"]);
  assert.deepEqual(all.submit.params, ["brief_id", "url"]);
  const open = calls.openBrief(" 0xABCDEF0000000000000000000000000000000001 ", " https://a.example/posts/ ", ["  Names the bag  ", "Links the shop"], 1700000000.7, 600.2, 9n * 10n ** 17n);
  assert.equal(open.args[0], "0xabcdef0000000000000000000000000000000001", "the creator travels lowercase");
  assert.equal(open.args[1], "https://a.example/posts/");
  assert.equal(open.args[2], '["Names the bag","Links the shop"]', "the lines travel as one JSON list of strings, stripped");
  assert.equal(open.args[3], 1700000000, "publish_by travels as an integer");
  assert.equal(open.args[4], 600, "hold_seconds travels as an integer");
  assert.equal(open.value, 9n * 10n ** 17n, "the fee is the value sent");
  assert.equal(calls.deposit(5n).value, 5n);
});

test("every view the site reads is a view of the contract, and the site reads every view", () => {
  const all = methods();
  const read = [...chainSource.matchAll(/view\("(\w+)"/g)].map((m) => m[1]);
  const views = Object.entries(all)
    .filter(([, m]) => m.kind === "view")
    .map(([n]) => n);
  assert.equal(views.length, 6);
  for (const name of read) assert.equal(all[name]?.kind, "view", `${name} is a view`);
  for (const name of views) assert.ok(read.includes(name), `the site reads ${name}`);
  for (const name of views) assert.ok(mockSource.includes(`case "${name}":`), `the in-memory contract answers ${name}`);
  assert.match(chainSource, /Math\.min\(PAGE, Math\.trunc\(limit\)\)/, "every list read asks for at most PAGE rows");
});

test("the limits, the disclosure and the questions are the contract's own, word for word", () => {
  const nums = {
    MIN_LEAD: 600, MIN_HOLD: 600, SUBMIT_GRACE: 86400, MIN_REQUIREMENTS: 1, MAX_REQUIREMENTS: 5, MIN_REQUIREMENT: 10, MAX_REQUIREMENT: 150, MAX_REQUIREMENTS_JSON: 2000,
    MAX_PREFIX: 120, MAX_URL: 200, MAX_SUBMITS: 2, MAX_RAW_PAGE: 32000, MAX_PAGE_TEXT: 6000, FP_CHARS: 16, PAGE: 20, ID_CHARS: 16, ADDRESS_CHARS: 42,
  };
  for (const [name, value] of Object.entries(nums)) {
    assert.equal(Number(constant(name)), value, `${name} in the contract`);
    assert.equal(rules[name], value, `${name} in lib/rules.ts`);
  }
  assert.equal(constant("MAX_LEAD"), "90 * 86400");
  assert.equal(rules.MAX_LEAD, 90 * 86400);
  assert.equal(constant("MAX_HOLD"), "30 * 86400");
  assert.equal(rules.MAX_HOLD, 30 * 86400);
  assert.equal(constant("MIN_FEE"), "ATTO // 10");
  assert.equal(rules.MIN_FEE, 10n ** 17n);
  assert.equal(constant("MAX_FEE"), "50 * ATTO");
  assert.equal(rules.MAX_FEE, 50n * 10n ** 18n);
  assert.equal(constant("SUBMIT_FEE"), "ATTO // 100");
  assert.equal(rules.SUBMIT_FEE, 10n ** 16n);
  assert.match(raw, /^URL_SIGNS = \("-", "\.", "_", "~", "\/"\)$/m);
  assert.deepEqual(rules.URL_SIGNS, ["-", ".", "_", "~", "/"]);
  assert.match(raw, /^GONE_STATUSES = \(404, 410\)/m);
  assert.equal(JSON.parse(constant("DISCLOSURE")), rules.DISCLOSURE);
  assert.equal(rules.QUESTION_MET, pyString("QUESTION_MET"));
  assert.equal(rules.QUESTION_UNMET, pyString("QUESTION_UNMET"));
  assert.equal(rules.READING, pyString("READING"));
  assert.equal(rules.RETURN_LIST, pyString("RETURN_LIST"));
  for (const s of rules.STATUSES) assert.ok(raw.includes(`= "${s}"`), `the contract has the status ${s}`);
});

/** The text of every call `name(...)` in a source, with its parentheses balanced (strings respected). */
function argsOf(source, name) {
  const out = [];
  let at = 0;
  for (;;) {
    const i = source.indexOf(name + "(", at);
    if (i < 0) return out;
    let depth = 0;
    let j = i + name.length;
    let quote = "";
    for (; j < source.length; j++) {
      const ch = source[j];
      if (quote) {
        if (ch === "\\") j++;
        else if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "`" || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")" && --depth === 0) break;
    }
    out.push(source.slice(i + name.length + 1, j));
    at = j;
  }
}

/** Every string literal in an expression, cut at its ${...} holes and its + joins: the pieces of a sentence the code writes itself. */
function pieces(expr) {
  const out = [];
  for (const m of expr.matchAll(/"((?:[^"\\]|\\.)*)"|`([^`]*)`/g)) {
    const text = (m[1] ?? m[2]).replace(/\\"/g, '"');
    for (const part of text.split(/\$\{[^}]*\}/)) {
      const p = part.trim().replace(/^[;:,.]\s*/, "");
      if (p.length >= 8) out.push(p);
    }
  }
  return out;
}

test("every refusal the in-memory contract raises is in the contract's own words", () => {
  const raised = argsOf(mockSource, "fail").filter((a) => /["`]/.test(a));
  assert.ok(raised.length >= 20, `found ${raised.length} refusals`);
  for (const r of raised) for (const p of pieces(r)) assert.ok(contract.includes(p), `the contract says "${p}"`);
  const notSettled = argsOf(mockSource, "new NotSettled").filter((a) => /["`]/.test(a));
  assert.ok(notSettled.length >= 2, `found ${notSettled.length} rounds that store nothing`);
  for (const r of notSettled) for (const p of pieces(r)) assert.ok(contract.includes(p.replace(/^\[TRANSIENT\]\s*/, "")), `the contract says "${p}"`);
  assert.ok(contract.includes(/FETCH_FAILED = "\[TRANSIENT\] ([^"]+)"/.exec(demoSource)[1]), "the demo build's failed fetch is the contract's sentence");
});

test("every sentence lib/rules.ts gives the forms is in the contract's own words", () => {
  const start = rulesSource.indexOf("// ---- reading the caller");
  const end = rulesSource.indexOf("/** The creator's share on a mask");
  const said = [...rulesSource.slice(start, end).matchAll(/return\s+\(?\s*([^;]+);/g)].map((m) => m[1]).filter((a) => /"/.test(a));
  assert.ok(said.length >= 20, `found ${said.length} sentences`);
  for (const r of said) for (const p of pieces(r)) assert.ok(contract.includes(p), `the contract says "${p}"`);
});

test("the readers of a caller's arguments answer as the contract's do", (t) => {
  const texts = [
    ["Mentions the Tidewell 20 L dry bag by name", 10, 150, "requirement 1"],
    ["short", 10, 150, "requirement 1"],
    ["two\nlines here, yes", 10, 150, "requirement 2"],
    ["café au lait mention", 10, 150, "requirement 1"],
    ["x".repeat(151), 10, 150, "requirement 3"],
    ["<b>angle brackets</b> are fine", 10, 150, "requirement 1"],
  ];
  const urls = [
    "https://raw.githubusercontent.com/demo-owner/sponsored/0123456789abcdef0123456789abcdef01234567/posts/full.html",
    "http://harbour-eats.example/posts/x",
    "https://Harbour-eats.example/posts/x",
    "https://harbour-eats/posts/x",
    "https://harbour-eats.example",
    "https://harbour-eats.example/a//b",
    "https://harbour-eats.example/a/../b",
    "https://harbour-eats.example/a/./b",
    "https://harbour-eats.example/p?q=1",
    "https://harbour-eats.example/a b",
    "https://.harbour.example/x",
    "https://harbour.example./x",
    "https://hárbour.example/x",
    "https://harbour.example/" + "a".repeat(190),
  ];
  const prefixes = ["https://harbour-eats.example/posts/", "https://harbour-eats.example/posts", "https://harbour-eats.example/", "https://x.example/" + "a".repeat(110) + "/"];
  const numbers = [0, 5, -1, "12", " 7 ", "1.5", "abc", "", "1".repeat(40), "1".repeat(41), true, null, 3.5, "١"];
  const addresses = ["0x" + "a".repeat(40), " 0X" + "A".repeat(40) + " ", "0x" + "g".repeat(40), "0x123", 42];
  const reqs = [
    '["Mentions the Tidewell 20 L dry bag by name"]',
    "[]",
    '["a","b","c","d","e","f"]',
    '["Mentions the bag", 1.5]',
    '["Mentions the bag", 2]',
    "not json",
    '{"a": 1}',
    '["Mentions the bag", "mentions the bag"]',
    '["Clearly says that the post is sponsored, an ad or paid for"]',
    '["  Mentions the bag  ", "Links to tidewell.example/bags"]',
    '["short"]',
    JSON.stringify(["x".repeat(150)]),
    '[NaN]',
    "  " + '["Mentions the bag by name"]' + "  ",
  ];
  const answers = askContract([
    ...texts.map((a) => ({ fn: "_text_problem", args: a })),
    ...urls.map((u) => ({ fn: "_url_problem", args: [u, 200, "the post address"] })),
    ...prefixes.map((p) => ({ fn: "_prefix_problem", args: [p] })),
    ...numbers.map((n) => ({ fn: "_number_arg", args: [n] })),
    ...addresses.map((a) => ({ fn: "_address_text", args: [a] })),
    ...reqs.map((r) => ({ fn: "_requirements_of", args: [r] })),
  ]);
  if (!answers) return t.skip("no python3 on this machine");
  let k = 0;
  for (const a of texts) assert.equal(rules.textProblem(...a), answers[k++].ok, `text ${JSON.stringify(a[0]).slice(0, 30)}`);
  for (const u of urls) assert.equal(rules.urlProblem(u, 200, "the post address"), answers[k++].ok, `url ${u.slice(0, 60)}`);
  for (const p of prefixes) assert.equal(rules.prefixProblem(p), answers[k++].ok, `prefix ${p.slice(0, 60)}`);
  for (const n of numbers) assert.equal(rules.numberArg(n).toString(), answers[k++].ok, `number ${JSON.stringify(n)}`);
  for (const a of addresses) assert.equal(rules.addressText(a), answers[k++].ok, `address ${JSON.stringify(a)}`);
  for (const r of reqs) {
    const mine = rules.requirementsOf(r);
    assert.deepEqual([mine.lines, mine.problem], answers[k++].ok, `requirements ${r.slice(0, 40)}`);
  }
});

test("the in-memory rules() is the contract's rules(), whole", async (t) => {
  const mine = JSON.parse(await mock.view("rules", []));
  const answers = askContract([{ fn: "rules" }]);
  if (!answers) return t.skip("no python3 on this machine");
  assert.deepEqual(mine, answers[0].ok);
});

test("a brief the contract would refuse is refused by the in-memory contract with the same sentence, and the fee comes back", async () => {
  const G = 10n ** 18n;
  const now = mock.mockNow();
  const ok = { creator: mock.DEMO_CREATOR, prefix: mock.MOCK_PREFIX, lines: '["Mentions the Tidewell 20 L dry bag by name"]', publishBy: now + 1800, hold: 600, fee: G };
  const cases = [
    { ...ok },
    { ...ok, creator: "0x123" },
    { ...ok, creator: "0x" + "0".repeat(40) },
    { ...ok, creator: mock.VISITOR },
    { ...ok, prefix: "https://harbour-eats.example/posts" },
    { ...ok, lines: "[]" },
    { ...ok, fee: G / 20n },
    { ...ok, fee: 51n * G },
    { ...ok, hold: 599 },
    { ...ok, publishBy: now + 60 },
    { ...ok, publishBy: now + 91 * 86400 },
  ];
  mock.setMockPersona(mock.VISITOR);
  for (const c of cases) {
    const expected = rules.openProblem({ sponsor: mock.VISITOR, creator: c.creator, prefix: c.prefix, requirementsJson: c.lines, feeAtto: c.fee, holdSeconds: c.hold, publishBy: c.publishBy, now: mock.mockNow() });
    const before = BigInt(mock.mockBalanceText(mock.VISITOR));
    const hash = await mock.write({ fn: "open_brief", args: [c.creator, c.prefix, c.lines, c.publishBy, c.hold], value: c.fee });
    let s;
    for (let i = 0; i < 20; i++) {
      s = await mock.txStatus(hash);
      if (s.status === "FINALIZED") break;
    }
    if (expected) {
      assert.equal(s.result.ok, false);
      assert.equal(s.result.reason, expected);
      assert.equal(BigInt(mock.mockBalanceText(mock.VISITOR)), before, "a refused brief sends everything back");
    } else assert.equal(s.result.ok, true, "a brief inside every limit opens");
  }
});
