// The waiting copy of lib/guide.ts, for every state of a brief and every role: each answers the five
// questions (what is happening, how long, must I act, can I leave, where is the money), the state named
// is the state the brief is in, the money line names amounts that match the brief, and nothing promises
// what the contract does not do. The in-between states (a wallet prompt, a transaction on its way, a
// post being read, a recheck, the demo creator at work) are checked the same way.

import test from "node:test";
import assert from "node:assert/strict";

import { BRIEF_STATES, briefGuide, briefLine, briefState, demoGuide, readingGuide, recheckGuide, sendingGuide, signGuide, updatingGuide } from "../../lib/guide.ts";

const G = 10n ** 18n;
const NOW = 1_800_000_000;
const ROLES = ["sponsor", "creator", "visitor"];

const base = {
  now: NOW,
  id: "B7",
  status: "offered",
  feeAtto: ((9n * G) / 10n).toString(),
  heldAtto: ((9n * G) / 10n).toString(),
  toCreatorAtto: "0",
  toSponsorAtto: "0",
  feesToSponsorAtto: "0",
  publishBy: NOW + 1200,
  submitCloses: NOW + 1200 + 86400,
  holdSeconds: 600,
  holdUntil: 0,
  closedAt: 0,
  tries: 0,
  submissions: [],
  met: 0,
  of: 3,
  rechecks: 0,
  recheckedAt: 0,
  up: "",
};
const held = (owed, back) => ({ status: "held", heldAtto: owed.toString(), toSponsorAtto: back.toString(), holdUntil: NOW + 300 });
const unclear = { url: "https://x.example/posts/a", mask: "unclear", fp: "0123456789abcdef", at: NOW - 60 };

/** One brief in each state, as the contract would hold it. */
const STATE_BRIEFS = {
  offered: {},
  "offered-missed": { publishBy: NOW - 10, submitCloses: NOW - 10 + 86400 },
  accepted: { status: "accepted" },
  unclear: { status: "accepted", tries: 1, submissions: [unclear], feesToSponsorAtto: (G / 100n).toString() },
  "accepted-spent": { status: "accepted", tries: 2, submissions: [unclear, unclear], feesToSponsorAtto: (G / 50n).toString() },
  expirable: { status: "accepted", publishBy: NOW - 90000, submitCloses: NOW - 3600 },
  "held-all": { ...held((9n * G) / 10n, 0n), met: 3 },
  "held-part": { ...held((6n * G) / 10n, (3n * G) / 10n), met: 2 },
  rechecked: { ...held((6n * G) / 10n, (3n * G) / 10n), met: 2, rechecks: 1, recheckedAt: NOW - 30, up: "yes" },
  releasable: { ...held((6n * G) / 10n, (3n * G) / 10n), met: 2, holdUntil: NOW - 1 },
  released: { status: "released", heldAtto: "0", toCreatorAtto: ((6n * G) / 10n).toString(), toSponsorAtto: ((3n * G) / 10n).toString(), closedAt: NOW - 5, met: 2 },
  hidden_ad: { status: "hidden_ad", heldAtto: "0", toSponsorAtto: ((9n * G) / 10n).toString(), closedAt: NOW - 5 },
  nothing_met: { status: "nothing_met", heldAtto: "0", toSponsorAtto: ((9n * G) / 10n).toString(), closedAt: NOW - 5 },
  taken_down: { status: "taken_down", heldAtto: "0", toSponsorAtto: ((9n * G) / 10n).toString(), closedAt: NOW - 5, rechecks: 1, up: "gone" },
  expired: { status: "expired", heldAtto: "0", toSponsorAtto: ((9n * G) / 10n).toString(), closedAt: NOW - 5 },
  declined: { status: "declined", heldAtto: "0", toSponsorAtto: ((9n * G) / 10n).toString(), closedAt: NOW - 5 },
  withdrawn: { status: "withdrawn", heldAtto: "0", toSponsorAtto: ((9n * G) / 10n).toString(), closedAt: NOW - 5 },
};

const FIVE = ["now", "time", "need", "leave", "money"];

function answersAll(g, where) {
  for (const k of FIVE) assert.ok(typeof g[k] === "string" && g[k].trim().length > 8, `${where}: ${k} says something`);
  assert.equal(typeof g.canLeave, "boolean", `${where}: says whether you can leave`);
  assert.equal(typeof g.mustAct, "boolean", `${where}: says whether you must act`);
  assert.ok(g.kicker, `${where}: a kicker`);
  assert.ok(/GEN|wallet|credit|money/.test(g.money), `${where}: the money line says where the money is`);
  for (const k of FIVE) assert.doesNotMatch(g[k], /undefined|NaN|\[object/, `${where}: ${k} has no hole in it`);
  assert.doesNotMatch(g.money, /guarantee|insured|refund in full within/i, `${where}: no promise the contract does not make`);
}

test("every state of a brief is reached, for every role, and answers the five questions", () => {
  assert.deepEqual(Object.keys(STATE_BRIEFS).sort(), [...BRIEF_STATES].sort(), "every state has a brief here");
  for (const [state, extra] of Object.entries(STATE_BRIEFS)) {
    for (const role of ROLES) {
      for (const demo of [false, true]) {
        const input = { ...base, ...extra, role, demo };
        assert.equal(briefState(input), state, `${state} is recognised`);
        const g = briefGuide(input);
        assert.equal(g.id, state);
        answersAll(g, `${state} for the ${role}${demo ? " (demo)" : ""}`);
        assert.ok(briefLine(input).includes(g.now), "the one-line form carries the same words");
      }
    }
  }
});

test("the money lines name the amounts the brief holds and where they went", () => {
  const g = (state, role = "sponsor") => briefGuide({ ...base, ...STATE_BRIEFS[state], role });
  assert.match(g("offered").money, /0\.9 GEN in escrow/);
  assert.match(g("held-part").money, /0\.6 GEN for the creator\. 0\.3 GEN went back to the sponsor at once/);
  assert.match(g("held-all").money, /Nothing went back: every line was met/);
  assert.match(g("released").money, /0\.6 GEN went to the creator and 0\.3 GEN back to the sponsor/);
  assert.match(g("hidden_ad").money, /The whole 0\.9 GEN went back to the sponsor; nothing to the creator/);
  assert.match(g("unclear").money, /Nothing moved from the escrow: the contract still holds 0\.9 GEN\. The 0\.01 GEN submit fee went from the creator's credit to the sponsor/);
  assert.match(g("releasable", "creator").money, /releasing sends all of it to you/);
  assert.match(g("releasable", "visitor").money, /releasing sends all of it to the creator/);
});

test("who must act: the creator to accept, post and release; the demo sponsor to press the demo creator's buttons; nobody to wait for a hold", () => {
  const must = (state, role, demo = false) => briefGuide({ ...base, ...STATE_BRIEFS[state], role, demo }).mustAct;
  assert.equal(must("offered", "creator"), true);
  assert.equal(must("offered", "sponsor"), false);
  assert.equal(must("offered", "sponsor", true), true);
  assert.equal(must("accepted", "creator"), true);
  assert.equal(must("accepted", "sponsor", true), true);
  assert.equal(must("accepted", "visitor", true), false);
  assert.equal(must("unclear", "creator"), true);
  assert.equal(must("held-all", "creator"), false);
  assert.equal(must("releasable", "creator"), true);
  assert.equal(must("expirable", "sponsor"), true);
  for (const s of ["released", "hidden_ad", "nothing_met", "taken_down", "expired", "declined", "withdrawn"]) for (const r of ROLES) assert.equal(must(s, r), false, `${s} is closed`);
});

test("the countdowns count to the next thing on the contract's clock", () => {
  const g = (state) => briefGuide({ ...base, ...STATE_BRIEFS[state], role: "sponsor" });
  assert.equal(g("offered").left, 1200);
  assert.equal(g("held-part").left, 300);
  assert.equal(g("offered-missed").left, 86390);
  assert.equal(g("released").left, undefined);
});

test("the in-between states answer the five questions too", () => {
  const fee = ((9n * G) / 10n).toString();
  for (const mock of [false, true]) {
    for (const fn of ["open_brief", "withdraw_brief", "decline", "accept", "deposit", "withdraw", "submit", "recheck", "release", "expire"]) answersAll(signGuide({ fn, label: "doing it", feeAtto: fee, heldAtto: fee, mock }), `sign ${fn}`);
    for (const fn of ["open_brief", "withdraw_brief", "decline", "accept", "deposit", "withdraw", "release", "expire"]) answersAll(sendingGuide({ fn, target: "B7", role: "sponsor", feeAtto: fee, heldAtto: fee, mock }), `sending ${fn}`);
    for (const role of ROLES)
      for (const stage of ["busy", "late"]) {
        answersAll(readingGuide({ role, brief: "B7", page: "full.html", feeAtto: fee, holdSeconds: 600, stage, mock }), `reading ${stage}`);
        answersAll(recheckGuide({ role, brief: "B7", heldAtto: fee, stage, mock }), `recheck ${stage}`);
      }
    answersAll(demoGuide({ state: "asking", what: "accepting B7", brief: "B7", feeAtto: fee, mock }), "demo asking");
    answersAll(demoGuide({ state: "failed", what: "accepting B7", brief: "B7", feeAtto: fee, reason: "offline", mock }), "demo failed");
  }
  answersAll(updatingGuide("Showing the reading"), "updating");
  assert.equal(signGuide({ fn: "open_brief", label: "x", feeAtto: "1", mock: false }).canLeave, false, "nobody leaves while the wallet asks");
  assert.equal(readingGuide({ role: "sponsor", brief: "B7", page: "full.html", feeAtto: "1", holdSeconds: 600, stage: "busy" }).canLeave, true, "the reading lands with the page closed");
});
