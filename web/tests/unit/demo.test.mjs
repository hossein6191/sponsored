// The demo creator and its four posts: each post in posts/ reads, and fingerprints, as lib/demo-creator.ts
// says (recomputed from the files, and asked of the contract itself); its words in the phone frame are
// the page's own; the expected masks are the README's; the demo lines and windows are inside the
// contract's limits; the pinned site fits a post prefix; and the server's key reader forgives what a
// person pastes and never repeats the key.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { DEMO_LINES, DEMO_POSTS, DEMO_WINDOWS, expectedMask, outcomeOfMask, postOfUrl, postUrl, postsBase, prefixFits, repoOf, splitOf } from "../../lib/demo-creator.ts";
import { BAD_KEY, NO_KEY, cleanKey, keyProblem } from "../../lib/demo-key.ts";
import { DEMO_LIMITS, createLimiter } from "../../lib/demo-limit.ts";
import { DISCLOSURE, MAX_HOLD, MAX_LEAD, MIN_HOLD, MIN_LEAD, owedOf, prefixProblem, requirementsOf, urlProblem } from "../../lib/rules.ts";
import { askContract } from "./oracle.mjs";

const html = (file) => readFileSync(new URL(`../../../posts/${file}`, import.meta.url), "utf8");
const README = readFileSync(new URL("../../../README.md", import.meta.url), "utf8").replace(/\s+/g, " ");

// The contract's _visible and _page_text, as tests/on_chain/smoke.mjs writes them.
const visible = (text) => {
  const pieces = text.slice(0, 32000).split("<");
  let out = pieces[0];
  for (const piece of pieces.slice(1)) {
    const close = piece.indexOf(">");
    if (close === -1) out += "<" + piece;
    else if (/^(script|style)/.test(piece.slice(0, 6).toLowerCase())) out += " ";
    else out += " " + piece.slice(close + 1);
  }
  return out;
};
const fpOf = (text) => createHash("sha256").update(visible(text).slice(0, 32000).split(/\s+/).filter(Boolean).join(" ").slice(0, 6000)).digest("hex").slice(0, 16);

test("each demo post fingerprints as the site says, by the site's reckoning and by the contract's own", (t) => {
  for (const p of DEMO_POSTS) assert.equal(fpOf(html(p.file)), p.fp, p.file);
  const answers = askContract(DEMO_POSTS.map((p) => ({ fn: "fingerprint", args: [html(p.file)] })));
  if (!answers) return t.skip("no python3 on this machine");
  DEMO_POSTS.forEach((p, i) => assert.equal(answers[i].ok, p.fp, `${p.file} by the contract`));
});

test("the phone frame shows each post's own words, heading and paragraphs, in order", () => {
  for (const p of DEMO_POSTS) {
    const page = html(p.file);
    const blocks = [...page.matchAll(/<(h1|p)>([\s\S]*?)<\/\1>/g)].map((m) => m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
    assert.deepEqual(blocks, [p.heading, ...p.paragraphs], p.file);
  }
});

test("the expected masks and outcomes are the README's, and the money splits as the contract's does", () => {
  const lines = [DISCLOSURE, ...DEMO_LINES];
  const fee = 9n * 10n ** 17n;
  for (const p of DEMO_POSTS) {
    assert.equal(expectedMask(p, lines), p.mask, p.key);
    assert.equal(outcomeOfMask(p.mask), p.outcome);
    assert.ok(README.includes("`" + p.file + "`") && README.includes("`" + p.mask + "`"), `the README lists ${p.file} as ${p.mask}`);
    const { owed, back } = splitOf(fee, p.mask);
    assert.equal(owed + back, fee);
    assert.equal(owed, owedOf(fee, p.mask));
  }
  assert.equal(splitOf(fee, "1101").owed, 6n * 10n ** 17n);
  assert.equal(expectedMask(DEMO_POSTS[0], [DISCLOSURE, "A line the demo never saw"]), null);
  assert.deepEqual(expectedMask(DEMO_POSTS[2], [DISCLOSURE, DEMO_LINES[2], DEMO_LINES[1]]), "110", "lines in another order are read by their words");
});

test("the demo lines and windows are inside the contract's limits, and the README's lines word for word", () => {
  assert.equal(requirementsOf(JSON.stringify(DEMO_LINES)).problem, "");
  for (const l of DEMO_LINES) assert.ok(README.includes(`"${l}"`), l);
  assert.ok(DEMO_WINDOWS.publishSeconds >= MIN_LEAD + 600 && DEMO_WINDOWS.publishSeconds <= MAX_LEAD);
  assert.ok(DEMO_WINDOWS.holdSeconds >= MIN_HOLD && DEMO_WINDOWS.holdSeconds <= MAX_HOLD);
});

test("the pinned site is a post prefix the contract takes, and each post sits below it", () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";
  const repo = repoOf("https://github.com/demo-owner/sponsored");
  assert.equal(repo, "demo-owner/sponsored");
  assert.equal(repoOf("https://github.com/demo-owner/sponsored.git"), "demo-owner/sponsored");
  assert.equal(repoOf("https://gitlab.example/a/b"), "");
  const base = postsBase(repo, commit);
  assert.ok(prefixFits(base));
  assert.equal(prefixProblem(base), "");
  for (const p of DEMO_POSTS) {
    const url = postUrl(repo, commit, p.key);
    assert.equal(urlProblem(url, 200, "the post address"), "");
    assert.equal(postOfUrl(url), p);
  }
  assert.equal(postOfUrl("https://raw.githubusercontent.com/a/b/c/README.md"), null);
  assert.ok(!prefixFits(postsBase("an-owner-with-a-very-long-name-indeed/" + "r".repeat(40), commit)), "a repository name too long for a prefix is caught");
});

test("the key reader forgives what a person pastes, and its sentences never carry the key", () => {
  const key = "ab".repeat(32);
  assert.equal(cleanKey(key), "0x" + key);
  assert.equal(cleanKey(` "0x${key}" `), "0x" + key);
  assert.equal(cleanKey("0X" + key), "0x" + key);
  assert.equal(keyProblem(undefined), NO_KEY);
  assert.equal(keyProblem("  ''  "), NO_KEY);
  assert.equal(keyProblem("0x1234"), BAD_KEY);
  assert.equal(keyProblem("'" + key + "'"), "");
  assert.ok(!BAD_KEY.includes(key) && !NO_KEY.includes(key));
});

test("the demo creator is asked about one brief at most once every twenty seconds, and twelve times a minute in all", () => {
  const l = createLimiter(DEMO_LIMITS);
  assert.equal(l.attempt("B1", 0).ok, true);
  assert.equal(l.attempt("B1", 1000).ok, false);
  assert.equal(l.attempt("B1", 20_000).ok, true);
  for (let i = 0; i < 10; i++) assert.equal(l.attempt("C" + i, 21_000).ok, true);
  assert.equal(l.attempt("Z", 21_500).ok, false, "the twelfth attempt within a minute waits");
});
