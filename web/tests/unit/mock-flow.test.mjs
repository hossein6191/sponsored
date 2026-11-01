// The in-memory contract of mock mode, end to end, for every way a brief can end: all met then released,
// a hidden ad, part met then rechecked and taken down, nothing met, unclear and re-submitted until it
// expires, declined, withdrawn, expired unaccepted, and a post that cannot be read. After every step the
// contract holds exactly the escrow plus the credit, and no GEN appears or disappears between the
// accounts and the contract. The demo creator acts only through its two doors, as the server's would.

import test from "node:test";
import assert from "node:assert/strict";

import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { DEMO_LINES, DEMO_WINDOWS } from "../../lib/demo-creator.ts";
import { SUBMIT_FEE } from "../../lib/rules.ts";

const G = 10n ** 18n;
const FEE = (9n * G) / 10n;
const FINAL = new Set(["FINALIZED", "UNDETERMINED", "CANCELED"]);

async function final(hash) {
  for (let i = 0; i < 60; i++) {
    const s = await mock.txStatus(hash);
    if (FINAL.has(s.status)) return s;
  }
  throw new Error("never final: " + hash);
}
async function as(persona, call) {
  mock.setMockPersona(persona);
  return final(await mock.write(call));
}
const brief = async (id) => JSON.parse(await mock.view("brief", [id]));
const bal = (a) => BigInt(mock.mockBalanceText(a));
const total = () => mock.ACCOUNTS.reduce((s, a) => s + bal(a), 0n) + mock.mockTotals().balance;

let SUPPLY = 0n;
function conserved(where) {
  const t = mock.mockTotals();
  assert.equal(t.balance, t.held + t.credit, `${where}: the contract holds exactly the escrow plus the credit`);
  assert.equal(total(), SUPPLY, `${where}: no GEN appeared or disappeared`);
}

/** The visitor opens a demo brief to the demo creator and has it accepted. */
async function demoBrief(lines = DEMO_LINES, hold = DEMO_WINDOWS.holdSeconds) {
  const s = await as(mock.VISITOR, calls.openBrief(mock.DEMO_CREATOR, mock.MOCK_PREFIX, lines, mock.mockNow() + DEMO_WINDOWS.publishSeconds, hold, FEE));
  assert.equal(s.result.ok, true, s.result.reason);
  const id = s.result.brief;
  const a = await mock.demoAccept(id);
  assert.equal(a.ok, true, a.reason);
  assert.equal((await final(a.hash)).result.status, "accepted");
  return id;
}
async function demoPost(id, key) {
  const a = await mock.demoPost(id, key);
  assert.equal(a.ok, true, a.reason);
  return final(a.hash);
}

test.before(async () => {
  await mock.view("stats", []); // seeds
  SUPPLY = total();
  conserved("after the seed");
});

test("the full post: every line met, held, refused an early release, then released to the creator", async () => {
  const sponsor0 = bal(mock.VISITOR);
  const creator0 = bal(mock.DEMO_CREATOR);
  const id = await demoBrief();
  conserved("opened");
  const r = await demoPost(id, "full");
  assert.equal(r.result.mask, "1111");
  assert.equal(r.result.status, "held");
  assert.equal(r.result.owed, FEE.toString());
  assert.equal(r.result.to_sponsor, "0");
  assert.equal(r.result.fee, "kept");
  const b = await brief(id);
  assert.equal(b.can.recheck, true);
  assert.equal(b.can.release, false);
  const early = await as(mock.PASSER_BY, calls.release(id));
  assert.match(early.message, /^\[EXPECTED\] the hold of B\d+ ends at \d+, in \d+ seconds; until then anyone may recheck the post$/);
  conserved("held");
  mock.advanceClock(DEMO_WINDOWS.holdSeconds + 5);
  const late = await as(mock.PASSER_BY, calls.recheck(id));
  assert.match(late.message, /the hold of B\d+ ended at \d+; anyone may release it now/);
  const rel = await as(mock.PASSER_BY, calls.release(id));
  assert.equal(rel.result.status, "released");
  assert.equal(rel.result.to_creator, FEE.toString());
  assert.equal(bal(mock.VISITOR), sponsor0 - FEE, "the sponsor paid the whole fee");
  assert.ok(bal(mock.DEMO_CREATOR) >= creator0 + FEE - SUBMIT_FEE * 5n, "the creator was paid (less any credit it deposited)");
  assert.equal((await brief(id)).status, "released");
  conserved("released");
});

test("the post with no #ad: a hidden ad, the whole fee straight back", async () => {
  const sponsor0 = bal(mock.VISITOR);
  const id = await demoBrief();
  const r = await demoPost(id, "no-disclosure");
  assert.equal(r.result.mask, "0111");
  assert.equal(r.result.status, "hidden_ad");
  assert.equal(r.result.to_sponsor, FEE.toString());
  assert.equal(bal(mock.VISITOR), sponsor0, "nothing paid for a hidden ad");
  const b = await brief(id);
  assert.equal(b.held, "0");
  assert.equal(b.to_creator, "0");
  conserved("hidden ad");
});

test("disclosed, no link: two thirds held, a third back at once; a recheck finds it up, then gone", async () => {
  const sponsor0 = bal(mock.VISITOR);
  const id = await demoBrief(DEMO_LINES, 3600);
  const r = await demoPost(id, "no-link");
  assert.equal(r.result.mask, "1101");
  assert.equal(r.result.met, 2);
  assert.equal(r.result.owed, ((FEE * 2n) / 3n).toString());
  assert.equal(r.result.to_sponsor, (FEE - (FEE * 2n) / 3n).toString());
  const up = await as(mock.PASSER_BY, calls.recheck(id));
  assert.equal(up.result.up, "yes");
  assert.equal(up.result.status, "held");
  conserved("rechecked up");
  mock.takeDown((await brief(id)).url);
  const gone = await as(mock.PASSER_BY, calls.recheck(id));
  assert.equal(gone.result.up, "gone");
  assert.equal(gone.result.status, "taken_down");
  assert.equal(bal(mock.VISITOR), sponsor0, "the held part came back too");
  conserved("taken down");
});

test("the wrong bag: disclosed, nothing met, the whole fee back", async () => {
  const id = await demoBrief();
  const r = await demoPost(id, "wrong-product");
  assert.equal(r.result.mask, "1000");
  assert.equal(r.result.status, "nothing_met");
  assert.equal(r.result.owed, "0");
  assert.equal(r.result.to_sponsor, FEE.toString());
  conserved("nothing met");
});

test("unclear twice: the submit fee moves to the sponsor each time, a third try is refused, and anyone expires it", async () => {
  const lines = [DEMO_LINES[0], "Says the bag is sewn from recycled sailcloth"];
  const open = await as(mock.VISITOR, calls.openBrief(mock.MY_CREATOR, mock.MY_SITE, lines, mock.mockNow() + 3600, 600, FEE));
  const id = open.result.brief;
  const stranger = await as(mock.PASSER_BY, calls.accept(id));
  assert.equal(stranger.message, `[EXPECTED] only the creator of ${id} may accept it`);
  assert.equal((await as(mock.MY_CREATOR, calls.accept(id))).result.status, "accepted");
  const outside = await as(mock.MY_CREATOR, calls.submit(id, "https://elsewhere.example/posts/full.html"));
  assert.match(outside.message, /the post is not below B\d+'s post prefix https:\/\/moss-and-kettle\.example\/posts\/; only the creator's own site is read/);
  const credit0 = BigInt(JSON.parse(await mock.view("credit", [mock.MY_CREATOR])).credit);
  const sponsor0 = bal(mock.VISITOR);
  const one = await as(mock.MY_CREATOR, calls.submit(id, mock.MY_SITE + "full.html"));
  assert.equal(one.result.mask, "unclear");
  assert.equal(one.result.fee, "to_sponsor");
  assert.equal(bal(mock.VISITOR), sponsor0 + SUBMIT_FEE, "the submit fee went to the sponsor");
  assert.equal((await brief(id)).can.submit, true, "one more try");
  const two = await as(mock.MY_CREATOR, calls.submit(id, mock.MY_SITE + "no-link.html"));
  assert.equal(two.result.mask, "unclear");
  assert.equal(two.result.try, 2);
  const three = await as(mock.MY_CREATOR, calls.submit(id, mock.MY_SITE + "full.html"));
  assert.match(three.message, /has had its submission and its one re-submission; it expires at \d+$/);
  const b = await brief(id);
  assert.equal(b.status, "accepted");
  assert.equal(b.held, FEE.toString(), "nothing moved from the escrow");
  assert.equal(b.fees_to_sponsor, (SUBMIT_FEE * 2n).toString());
  assert.equal(BigInt(JSON.parse(await mock.view("credit", [mock.MY_CREATOR])).credit), credit0 - SUBMIT_FEE * 2n);
  const early = await as(mock.PASSER_BY, calls.expire(id));
  assert.match(early.message, /can expire from \d+, a day after publish_by, in \d+ seconds$/);
  mock.advanceClock(3600 + 86400 + 1);
  const ex = await as(mock.PASSER_BY, calls.expire(id));
  assert.equal(ex.result.status, "expired");
  assert.equal(ex.result.to_sponsor, FEE.toString());
  conserved("expired after unclear readings");
});

test("a post that cannot be read stores nothing and takes no fee", async () => {
  const open = await as(mock.VISITOR, calls.openBrief(mock.MY_CREATOR, mock.MY_SITE, DEMO_LINES, mock.mockNow() + 3600, 600, FEE));
  const id = open.result.brief;
  await as(mock.MY_CREATOR, calls.accept(id));
  await as(mock.MY_CREATOR, calls.deposit(SUBMIT_FEE));
  const credit0 = JSON.parse(await mock.view("credit", [mock.MY_CREATOR])).credit;
  const s = await as(mock.MY_CREATOR, calls.submit(id, mock.MY_SITE + "a-page-nobody-wrote"));
  assert.equal(s.status, "UNDETERMINED");
  assert.match(s.message, /the post could not be fetched; nothing was stored, no fee was taken, and it may be submitted again/);
  const b = await brief(id);
  assert.equal(b.tries, 0);
  assert.equal(b.status, "accepted");
  assert.equal(JSON.parse(await mock.view("credit", [mock.MY_CREATOR])).credit, credit0);
  conserved("unread post");
});

test("declined, withdrawn, and expired before anyone accepted: the whole fee back each time", async () => {
  const sponsor0 = bal(mock.VISITOR);
  const a = (await as(mock.VISITOR, calls.openBrief(mock.MY_CREATOR, mock.MY_SITE, DEMO_LINES, mock.mockNow() + 3600, 600, FEE))).result.brief;
  const notYours = await as(mock.PASSER_BY, calls.decline(a));
  assert.equal(notYours.message, `[EXPECTED] only the creator of ${a} may decline it`);
  assert.equal((await as(mock.MY_CREATOR, calls.decline(a))).result.status, "declined");
  const b = (await as(mock.VISITOR, calls.openBrief(mock.MY_CREATOR, mock.MY_SITE, DEMO_LINES, mock.mockNow() + 3600, 600, FEE))).result.brief;
  assert.equal((await as(mock.MY_CREATOR, calls.withdrawBrief(b))).message, `[EXPECTED] only the sponsor of ${b} may withdraw it`);
  assert.equal((await as(mock.VISITOR, calls.withdrawBrief(b))).result.status, "withdrawn");
  const c = (await as(mock.VISITOR, calls.openBrief(mock.MY_CREATOR, mock.MY_SITE, DEMO_LINES, mock.mockNow() + 3600, 600, FEE))).result.brief;
  mock.advanceClock(3600 + 1);
  const missed = await as(mock.MY_CREATOR, calls.accept(c));
  assert.match(missed.message, /publish_by of B\d+ passed at \d+; a brief is accepted before it/);
  mock.advanceClock(86400);
  assert.equal((await as(mock.PASSER_BY, calls.expire(c))).result.status, "expired");
  assert.equal(bal(mock.VISITOR), sponsor0, "every fee came back");
  conserved("declined, withdrawn, expired");
});

test("credit: a submission with too little is refused before anything is read; a deposit and a withdrawal move only the sender's own", async () => {
  const fresh = mock.PASSER_BY;
  const open = await as(mock.VISITOR, calls.openBrief(fresh, mock.MY_SITE, DEMO_LINES, mock.mockNow() + 3600, 600, FEE));
  const id = open.result.brief;
  await as(fresh, calls.accept(id));
  const short = await as(fresh, calls.submit(id, mock.MY_SITE + "full.html"));
  assert.match(short.message, /a submission takes a fee of 10000000000000000 atto from the creator's credit, and the credit is 0; deposit first$/);
  const nothing = await as(fresh, calls.withdraw());
  assert.match(nothing.message, /there is no credit to withdraw for 0x/);
  const zero = await as(fresh, calls.deposit(0n));
  assert.equal(zero.result.ok, false);
  const dep = await as(fresh, calls.deposit(SUBMIT_FEE * 3n));
  assert.equal(dep.result.credit, (SUBMIT_FEE * 3n).toString());
  const r = await as(fresh, calls.submit(id, mock.MY_SITE + "full.html"));
  assert.equal(r.result.mask, "1111");
  assert.equal(r.result.credit, (SUBMIT_FEE * 3n).toString(), "a clear reading keeps the fee in the creator's credit");
  const back = await as(fresh, calls.withdraw());
  assert.equal(back.result.withdrawn, (SUBMIT_FEE * 3n).toString());
  conserved("credit");
});

test("the demo creator acts only on briefs made to it, at its own site, through its fixed posts", async () => {
  const other = (await as(mock.VISITOR, calls.openBrief(mock.MY_CREATOR, mock.MY_SITE, DEMO_LINES, mock.mockNow() + 3600, 600, FEE))).result.brief;
  const a = await mock.demoAccept(other);
  assert.equal(a.ok, false);
  assert.match(a.reason, /is not a brief to the demo creator/);
  const wrongSite = (await as(mock.VISITOR, calls.openBrief(mock.DEMO_CREATOR, mock.MY_SITE, DEMO_LINES, mock.mockNow() + 3600, 600, FEE))).result.brief;
  const w = await mock.demoAccept(wrongSite);
  assert.equal(w.ok, false);
  assert.match(w.reason, /post prefix is not the demo creator's site/);
  const offered = (await as(mock.VISITOR, calls.openBrief(mock.DEMO_CREATOR, mock.MOCK_PREFIX, DEMO_LINES, mock.mockNow() + 3600, 600, FEE))).result.brief;
  const early = await mock.demoPost(offered, "full");
  assert.equal(early.ok, false);
  assert.match(early.reason, /the demo creator posts only on an accepted brief/);
  const odd = await mock.demoPost(offered, "anything-else");
  assert.equal(odd.ok, false);
  assert.equal(odd.reason, "the demo creator does only what its buttons say");
  conserved("demo doors");
});

test("the views answer in the contract's shapes", async () => {
  const page = JSON.parse(await mock.view("briefs", [0, 5]));
  assert.equal(page.limit, 5);
  assert.equal(page.rows.length, 5);
  assert.ok(page.total >= 8);
  const big = JSON.parse(await mock.view("briefs", [0, 500]));
  assert.equal(big.limit, 20, "a page is never longer than PAGE rows");
  const mine = JSON.parse(await mock.view("briefs_of", [mock.VISITOR.toUpperCase().replace("0X", "0x"), 0, 20]));
  assert.ok(mine.rows.every((r) => r.role === "sponsor"));
  const none = JSON.parse(await mock.view("brief", ["B99999"]));
  assert.equal(none.error, "no brief B99999");
  const one = JSON.parse(await mock.view("brief", ["B1"]));
  assert.deepEqual(Object.keys(one.can).sort(), ["accept", "expire", "recheck", "release", "submit"]);
  assert.equal(one.requirements[0], "Clearly says that the post is sponsored, an ad or paid for");
  const stats = JSON.parse(await mock.view("stats", []));
  assert.equal(stats.briefs, page.total);
  assert.equal(BigInt(stats.held) + BigInt(stats.credit), mock.mockTotals().balance);
});
