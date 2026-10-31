/* Sponsored against GenLayer Studio (chain 61999), with throwaway accounts. Deploys its own copy.
 *
 *   npm ci                                                   # genlayer-js 1.1.8 and viem 2.56.8, pinned by package-lock.json
 *   COMMIT=<sha> node tests/on_chain/smoke.mjs               # the whole run, about forty minutes
 *   COMMIT=<sha> RESUME=1 node tests/on_chain/smoke.mjs      # continue a run that was cut off, from the saved state
 *   STATE=/some/dir/run.json ...                             # the state file: keys, contract address, every step made
 *   FRESH=1 ...                                              # start over even though a saved run exists
 *
 * The validators read the posts from raw.githubusercontent.com, pinned to one commit, so the page every node
 * fetches is the same bytes. Push the repository first and pass that commit as COMMIT (40 hex characters). REPO
 * is "<owner>/<name>" on GitHub; when it is not set it is read from `git remote get-url origin`. The script
 * fetches the posts itself before it deploys anything, and stops if they are not there.
 *
 * Three accounts the script generates and funds itself play the whole story: SPONSOR is Tidewell, which pays for
 * posts about its 20 L dry bag; CREATOR writes the Harbour Eats blog, whose posts sit under posts/ at COMMIT;
 * STRANGER tries what only the other two may do, and does what anyone may. Each brief's fee is 0.9 GEN, 0.3 GEN
 * for each of the sponsor's three lines; a submission takes 0.01 GEN of credit; each post must stay up 600 s.
 *
 * Phases:
 *   A  deploy. SPONSOR opens B1, B2 and B3 for CREATOR with the same three lines, each 0.9 GEN held in escrow;
 *      the contract adds the disclosure as line 0. STRANGER tries to accept B1 and is refused. SPONSOR tries to
 *      name itself as the creator: refused, and the 0.9 GEN comes back in the same transaction. CREATOR accepts
 *      all three and deposits 0.05 GEN of credit.
 *   B  the posts, one consensus round per submission, read on the live web:
 *        STRANGER submits full.html for B1: refused, only the creator submits
 *        CREATOR submits the repository's README: refused before anything is fetched, outside the post prefix
 *        B1 full.html           1111: the whole 0.9 GEN held for CREATOR until the hold ends
 *        B2 no-disclosure.html  0111: a hidden ad, the whole 0.9 GEN back to SPONSOR, B2 closes
 *        B3 no-link.html        1101: two of three lines, 0.6 GEN held, 0.3 GEN back to SPONSOR at once
 *      STRANGER tries to release B1 at once: refused, the hold has not ended. STRANGER rechecks B3: still up,
 *      nothing moves. (A recheck that finds the post gone needs the post to disappear after it was read; a page
 *      pinned to a commit never does, so the run shows the post still up and the tests show it gone.)
 *   C  on the chain's own clock, once each hold has ended, STRANGER releases B1 (0.9 GEN to CREATOR) and B3 (0.6 GEN
 *      to CREATOR). A recheck of B1 after its hold is refused.
 *   D  the deployed code is read back and compared with contracts/sponsored.py byte for byte; the views are checked
 *      against what the run did; CREATOR takes its credit back; the contract holds nothing; every account ends
 *      where the money says: SPONSOR down 1.5 GEN, CREATOR up 1.5 GEN, STRANGER whole.
 *
 * Every refusal is a signed transaction. Balances are read before and after every step that moves money.
 * Transactions are polled with eth_getTransactionByHash, never with views (gen_call is limited to 30 a minute
 * per client, shared with sim_fundAccount). A round the validators do not carry stores nothing; it is sent again
 * and both transactions are kept. Every id is read from the receipt of the call that made it. Every step is saved
 * as it is made, so a run cut off by a closed laptop continues with RESUME=1 without sending anything twice.
 */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const STATE = process.env.STATE || join(tmpdir(), "sponsored-smoke-state.json");
const RECORD = process.env.RECORD || STATE.replace(/\.json$/, "") + "-record.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const rpc = async (m, p) => {
  let last;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) });
      const j = await r.json();
      if (j.error && (j.error.code === -32029 || r.status === 429)) { await sleep(((j.error.data?.retry_after_seconds) || 20) * 1000); continue; }
      if (j.error) { last = new Error(m + ": " + JSON.stringify(j.error).slice(0, 200)); await sleep(6000); continue; }
      return j.result;
    } catch (e) { last = e; await sleep(4000); }   // the connection itself failed, or the answer was not JSON
  }
  throw last;
};
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); return !!c; };
const note = (s) => console.log(`      .. ${s}`);
const GEN = 10n ** 18n;
const tally = (v) => `${v.agree} agree, ${v.disagree} disagree, ${v.idle} idle`;
const sha = (text) => createHash("sha256").update(text).digest("hex");

// ---------- where the validators will read the posts ----------
const COMMIT = String(process.env.COMMIT || "").trim();
if (!/^[0-9a-f]{40}$/.test(COMMIT)) {
  console.log("COMMIT must be the 40-character commit the posts were pushed in: COMMIT=<sha> node tests/on_chain/smoke.mjs");
  process.exit(2);
}
let REPO = String(process.env.REPO || "").trim();
if (!REPO) {
  try {
    const origin = execSync("git remote get-url origin", { cwd: new URL("../..", import.meta.url), encoding: "utf8" }).trim();
    REPO = (origin.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/) || [])[1] || "";
  } catch (e) { REPO = ""; }
}
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(REPO)) {
  console.log("REPO must be <owner>/<name> on GitHub (or set the git remote origin): REPO=<owner>/sponsored COMMIT=<sha> ...");
  process.exit(2);
}
const RAW_ROOT = `https://raw.githubusercontent.com/${REPO}/${COMMIT}/`;
const POSTS = RAW_ROOT + "posts/";
if (POSTS.length > 120) {
  console.log(`The post prefix ${POSTS} must be at most 120 characters (the contract's own rule); use a shorter repository name.`);
  process.exit(2);
}
const PAGE = { full: POSTS + "full.html", noDisclosure: POSTS + "no-disclosure.html", noLink: POSTS + "no-link.html" };
const OUTSIDE = RAW_ROOT + "README.md";          // a real page of the same commit, but not below the prefix
const LOCAL = {};
for (const [name, address] of Object.entries(PAGE)) {
  LOCAL[name] = readFileSync(new URL("../../posts/" + address.slice(POSTS.length), import.meta.url), "utf8");
  let there = "";
  try { const r = await fetch(address); there = r.ok ? await r.text() : ""; } catch (e) { there = ""; }
  if (there !== LOCAL[name]) {
    console.log(`${address}\ndoes not serve posts/${address.slice(POSTS.length)} as it is in this checkout. Push the repository and pass that commit as COMMIT.`);
    process.exit(2);
  }
}
// what every validator should fingerprint: the first 32,000 characters with their tags removed (and the text after a
// script or style tag), then their spacing collapsed, at most 6,000; the contract's _visible and _page_text
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
const fpOf = (text) => sha(visible(text).slice(0, 32000).split(/\s+/).filter(Boolean).join(" ").slice(0, 6000)).slice(0, 16);

// ---------- state: keys, the contract address and every step already made survive a cut-off run ----------
if (existsSync(STATE) && !process.env.RESUME && !process.env.FRESH) {
  console.log(`A saved run exists at ${STATE}.\nRESUME=1 continues it; FRESH=1 starts over; STATE=<path> keeps another.`);
  process.exit(2);
}
const st = existsSync(STATE) && process.env.RESUME && !process.env.FRESH ? JSON.parse(readFileSync(STATE, "utf8")) : {};
st.keys = st.keys || {}; st.steps = st.steps || {}; st.views = st.views || {}; st.order = st.order || [];
st.commit = st.commit || COMMIT; st.repo = st.repo || REPO;
if (st.commit !== COMMIT) { console.log(`This saved run used commit ${st.commit}; continue it with that COMMIT, or start over with FRESH=1.`); process.exit(2); }
const save = () => {
  writeFileSync(STATE, JSON.stringify(st, null, 1));
  const { keys, ...shown } = st;       // the record carries no key
  writeFileSync(RECORD, JSON.stringify(shown, null, 1));
};
const ROLES = { sponsor: "SPONSOR, Tidewell", creator: "CREATOR, who writes Harbour Eats", stranger: "STRANGER" };
for (const k of Object.keys(ROLES)) st.keys[k] = st.keys[k] || generatePrivateKey();
const acct = {}, client = {};
for (const k of Object.keys(ROLES)) { acct[k] = createAccount(st.keys[k]); client[k] = createClient({ chain: studionet, account: acct[k] }); }
const rd = createClient({ chain: studionet });
st.accounts = Object.fromEntries(Object.keys(ROLES).map((k) => [k, getAddress(acct[k].address)]));
save();

const balance = async (a) => BigInt(await rpc("eth_getBalance", [a, "latest"]) || "0x0");
const nonceOf = async (a) => Number(BigInt(await rpc("eth_getTransactionCount", [a, "latest"]) || "0x0"));
const fundOnce = async (k, whole) => {
  st.funded = st.funded || {};
  if (st.funded[k]) return;
  await rpc("sim_fundAccount", { account_address: getAddress(acct[k].address), amount: whole * 1e18 });   // checksummed
  for (let i = 0; i < 20 && (await balance(acct[k].address)) === 0n; i++) await sleep(3000);
  st.funded[k] = String(await balance(acct[k].address)); save();
};

// ---------- transactions ----------
const errText = (e) => String(e?.details || e?.shortMessage || e?.cause?.message || e?.message || e);
// A request the network refused or never received is made again. When the failure is ambiguous the
// sender's nonce says whether the transaction landed after all, and its hash is read back, so nothing
// is ever sent twice.
const sendRaw = async (who, what, make) => {
  const addr = acct[who].address;
  for (let i = 0; ; i++) {
    const n0 = await nonceOf(addr);
    try { return await make(); } catch (e) {
      const text = errText(e);
      if (i >= 8) throw e;
      console.log(`      ${what} was not taken (${text.slice(0, 70)}); looking again in 20s`);
      await sleep(20000);
      if ((await nonceOf(addr)) > n0) {
        const list = await rpc("sim_getTransactionsForAddress", [addr]);
        const hit = (list || []).find((t) => String(t.from_address).toLowerCase() === addr.toLowerCase() && Number(t.nonce) === n0);
        if (hit?.hash) return hit.hash;
        throw new Error(what + " landed but its hash could not be read back");
      }
    }
  }
};
const countVotes = (t) => { let a = 0, d = 0, idl = 0; for (const k in (t.consensus_data?.votes || {})) { const v = t.consensus_data.votes[k]; if (v === "agree") a++; else if (v === "disagree") d++; else idl++; } return { agree: a, disagree: d, idle: idl }; };
const wait = async (tx) => {
  let stuck = 0;
  for (let i = 0; i < 900; i++) {
    await sleep(4000);
    const t = await rpc("eth_getTransactionByHash", [tx]);
    if (t?.status === "FINALIZED") {
      const lr = t.consensus_data?.leader_receipt, one = Array.isArray(lr) ? lr[0] : lr;
      let msg = "";
      try { msg = Buffer.from(one.result, "base64").toString("utf8").replace(/[^\x20-\x7e]/g, " ").trim(); } catch (e) {}
      const v = countVotes(t);
      return { tx, msg, exec: one?.execution_result || "", votes: v, applied: v.agree * 2 > v.agree + v.disagree + v.idle, address: t.data?.contract_address || t.to_address || "" };
    }
    // a round no majority carried is final as it stands once it has been left alone for ten minutes
    if (t?.status === "UNDETERMINED" && (stuck = stuck + 1) > 150) return { tx, msg: "UNDETERMINED", exec: "", votes: countVotes(t), applied: false, address: "" };
    if (t?.status === "CANCELED") return { tx, msg: "CANCELED", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
    if (i > 0 && i % 75 === 0) console.log(`      [${stamp()}] still ${t?.status || "unknown"} after ${Math.round(i * 4 / 60)} minutes: ${tx}`);
  }
  return { tx, msg: "TIMEOUT", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
};
const jsonOf = (msg) => { const b = String(msg).indexOf("{"); if (b === -1) return null; try { return JSON.parse(String(msg).slice(b)); } catch (e) { return null; } };
const settleBalance = async (a, before, want) => { for (let i = 0; i < 45; i++) { const b = await balance(a); if (b - before === want) return b; await sleep(4000); } return await balance(a); };

// One step of the run: a signed transaction, its tally, what it returned, and the balances it moved.
// opt.value is what is sent with it; opt.watch names the accounts whose balances are read before and
// after; opt.expect is the change each should show once every transfer has landed, a table or a
// function of what the call returned. A step already in the saved state is not sent again.
const call = async (id, who, fn, args = [], opt = {}) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn, args: args.map(String), value: String(opt.value || 0n), tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const watch = opt.watch || [];
    if (!rec.before) { rec.before = {}; for (const k of watch) rec.before[k] = String(await balance(acct[k].address)); save(); }
    let r;
    for (;;) {
      if (!rec.pending) {
        rec.pending = await sendRaw(who, fn, () => client[who].writeContract({ address: st.contract, functionName: fn, args, ...(opt.value ? { value: opt.value } : {}) }));
        save();
      }
      r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg, at: stamp() });
      rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} ${fn}(${args.map((x) => String(x).slice(-30)).join(", ")})${opt.value ? " +" + Number(opt.value) / 1e18 + " GEN" : ""}  ${r.tx}  ${tally(r.votes)}  ${r.exec}`);
      if (r.msg === "TIMEOUT" || rec.tries.length >= 4) break;
      if (!r.applied) { console.log("      the validators did not carry that round (" + tally(r.votes) + "), so nothing was stored; sending it again"); continue; }
      break;
    }
    const expect = typeof opt.expect === "function" ? opt.expect(jsonOf(r.msg)) : opt.expect;
    rec.after = {}; rec.delta = {};
    for (const k of watch) {
      const before = BigInt(rec.before[k]);
      const want = expect && expect[k] !== undefined ? BigInt(expect[k]) : null;
      const now = want === null ? await balance(acct[k].address) : await settleBalance(acct[k].address, before, want);
      rec.after[k] = String(now); rec.delta[k] = String(now - before);
    }
    rec.done = true; save();
  }
  const last = rec.tries[rec.tries.length - 1];
  return { ...last, j: jsonOf(last.msg), tries: rec.tries, delta: rec.delta || {} };
};
const refused = (r, words) => r.exec === "ERROR" && r.msg.includes(words);
const moved = (r, k, want) => r.delta[k] === String(want);
const votes = (r) => r.tries.map((t) => tally(t.votes)).join(", then ");

const deploy = async (id, who, path) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn: "deploy " + path.split("/").pop(), args: [], value: "0", tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const code = readFileSync(new URL(path, import.meta.url));
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, "deploy", () => client[who].deployContract({ code, args: [], leaderOnly: false })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg.slice(0, 300), at: stamp() });
      rec.address = r.address; rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} deploy ${path.split("/").pop()}  ${r.tx}  ${tally(r.votes)}  ${r.exec}  ${r.address}`);
      if (r.applied || r.msg === "TIMEOUT" || rec.tries.length >= 3) break;
    }
    rec.done = true; save();
  }
  return rec.address;
};

// ---------- reads: paced, and made again on a 429 or on "Contract not found" instead of failing ----------
let lastRead = 0;
const read = async (fn, args = []) => {
  for (let i = 0; i < 30; i++) {
    const gap = 3500 - (Date.now() - lastRead);
    if (gap > 0) await sleep(gap);
    lastRead = Date.now();
    try { return JSON.parse(String(await rd.readContract({ address: st.contract, functionName: fn, args }))); } catch (e) {
      if (i === 29) return { error: "VIEW ERROR " + fn + ": " + errText(e).slice(0, 100) };
      await sleep(/rate|429|limit/i.test(errText(e)) ? 25000 : 10000);
    }
  }
};
// a view read once for a check is kept with the run, so a continued run checks what was seen then
const seen = async (id, fn, args = []) => { if (!st.views[id]) { st.views[id] = { fn, args, at: stamp(), out: await read(fn, args) }; save(); } return st.views[id].out; };

// Wait on the chain's own clock, read from brief(id), until `target` (unix seconds) has passed by MARGIN.
const MARGIN = 30;
const untilChain = async (bid, target, why) => {
  for (;;) {
    const r = await read("brief", [bid]);
    const now = r && !r.error && Number(r.now) > 0 ? Number(r.now) : Math.floor(Date.now() / 1000);
    const left = target + MARGIN - now;
    if (left <= 0) return now;
    console.log(`      [${stamp()}] waiting ${left}s until ${why}`);
    await sleep(Math.min(left, 120) * 1000);
  }
};

// ---------- the demonstration: Tidewell's brief for Harbour Eats; the same words as tests/test_pure.py ----------
const LINES = [
  "Mentions the Tidewell 20 L dry bag by name",
  "Links to tidewell.example/bags",
  "Mentions that the bag comes in orange",
];
const DISCLOSURE = "Clearly says that the post is sponsored, an ad or paid for";
const QUESTION_MET = "Which numbered REQUIREMENTS does the PAGE meet? Answer with the list of those numbers, for example [0, 2], or [] for none.";
const QUESTION_UNMET = "Which numbered REQUIREMENTS does the PAGE fail to meet, because it leaves them out, contradicts them, or is too vague to tell? Answer with the list of those numbers, or [] for none.";
const FEE = 9n * GEN / 10n, SUBMIT_FEE = GEN / 100n;
const HOLD = 600;
const LEAD = 3600;                                // publish_by is about an hour after each brief opens
const OWED_B3 = FEE * 2n / 3n, BACK_B3 = FEE - OWED_B3;
const publishBy = (key) => { if (!st[key]) { st[key] = Math.floor(Date.now() / 1000) + LEAD; save(); } return st[key]; };

await fundOnce("sponsor", 6); await fundOnce("creator", 2); await fundOnce("stranger", 2);
if (!st.start) { st.start = {}; for (const k of Object.keys(ROLES)) st.start[k] = String(await balance(acct[k].address)); st.started = new Date().toISOString(); save(); }
console.log(`[${stamp()}] ${Object.keys(ROLES).map((k) => k.toUpperCase().padEnd(8) + " " + st.accounts[k]).join("\n           ")}\n           posts ${POSTS}\n           state ${STATE}`);
const CREATOR = st.accounts.creator;

// ================================================================ phase A
console.log(`\n[${stamp()}] ---- phase A: deploy, three briefs in escrow, the creator takes them on`);
st.contract = st.contract || await deploy("deploy", "sponsor", "../../contracts/sponsored.py");
save();
console.log(`      Sponsored at ${st.contract}`);
const brief = {};
for (const [id, key] of [["openB1", "publishBy1"], ["openB2", "publishBy2"], ["openB3", "publishBy3"]]) {
  const r = await call(id, "sponsor", "open_brief", [CREATOR, POSTS, JSON.stringify(LINES), publishBy(key), HOLD], { value: FEE, watch: ["sponsor"], expect: { sponsor: -FEE } });
  ok(`SPONSOR opens ${r.j?.brief} for CREATOR: three lines, the disclosure added as line 0, 0.9 GEN held`, r.j?.ok === true && r.j?.requirements?.[0] === DISCLOSURE && r.j?.requirements?.[3] === LINES[2] && r.j?.held === String(FEE) && r.j?.post_prefix === POSTS && moved(r, "sponsor", -FEE), `${votes(r)}  ${r.msg.slice(0, 120)}`);
  brief[id] = r.j?.brief || "";
}
const [b1, b2, b3] = [brief.openB1 || "B1", brief.openB2 || "B2", brief.openB3 || "B3"];
const sa = await call("acceptStranger", "stranger", "accept", [b1]);
ok(`STRANGER may not accept ${b1}`, refused(sa, "only the creator of " + b1 + " may accept it"), `${votes(sa)}  ${sa.msg.slice(0, 110)}`);
const self = await call("openSelf", "sponsor", "open_brief", [st.accounts.sponsor, POSTS, JSON.stringify(LINES), publishBy("publishBy1"), HOLD], { value: FEE, watch: ["sponsor"], expect: { sponsor: 0n } });
ok("SPONSOR may not name itself as the creator, and the 0.9 GEN comes back in the same transaction", self.exec !== "ERROR" && self.j?.ok === false && String(self.j?.reason).includes("the sponsor may not name itself as the creator") && self.j?.returned === String(FEE) && moved(self, "sponsor", 0n), `${votes(self)}  ${self.j?.reason}`);
for (const [id, bid] of [["acceptB1", b1], ["acceptB2", b2], ["acceptB3", b3]]) {
  const r = await call(id, "creator", "accept", [bid]);
  ok(`CREATOR accepts ${bid} before publish_by`, r.j?.ok === true && r.j?.status === "accepted", `${votes(r)}  ${r.msg.slice(0, 100)}`);
}
const dep = await call("deposit", "creator", "deposit", [], { value: 5n * SUBMIT_FEE, watch: ["creator"], expect: { creator: -5n * SUBMIT_FEE } });
ok("CREATOR deposits 0.05 GEN of credit for submit fees", dep.j?.ok === true && dep.j?.credit === String(5n * SUBMIT_FEE) && moved(dep, "creator", -5n * SUBMIT_FEE), `${votes(dep)}  ${dep.msg.slice(0, 100)}`);

// ================================================================ phase B
console.log(`\n[${stamp()}] ---- phase B: the posts, every one read by the validators on the live web`);
const strangerPost = await call("submitStranger", "stranger", "submit", [b1, PAGE.full]);
ok(`STRANGER may not submit a post for ${b1}`, refused(strangerPost, "only the creator of " + b1 + " may submit a post for it"), `${votes(strangerPost)}  ${strangerPost.msg.slice(0, 120)}`);
const outside = await call("submitOutside", "creator", "submit", [b1, OUTSIDE], { watch: ["creator", "sponsor"], expect: { creator: 0n, sponsor: 0n } });
ok("CREATOR points at the repository's README, outside the post prefix: refused before any fetch, no fee", refused(outside, "the post is not below " + b1 + "'s post prefix " + POSTS) && moved(outside, "sponsor", 0n), `${votes(outside)}  ${outside.msg.slice(0, 160)}`);
const r1 = await call("submitFull", "creator", "submit", [b1, PAGE.full], { watch: ["sponsor"], expect: (j) => ({ sponsor: j?.mask === "unclear" ? SUBMIT_FEE : 0n }) });
ok(`every validator reads full.html for ${b1}: 1111, the whole 0.9 GEN held for CREATOR until the hold ends`, r1.applied && r1.j?.mask === "1111" && r1.j?.status === "held" && r1.j?.held === String(FEE) && r1.j?.to_sponsor === "0" && r1.j?.fee === "kept" && /^[0-9a-f]{16}$/.test(String(r1.j?.fp)) && moved(r1, "sponsor", 0n), `${votes(r1)}  ${JSON.stringify({ mask: r1.j?.mask, fp: r1.j?.fp, hold_until: r1.j?.hold_until })}`);
if (r1.j?.fp) note(`the stored fingerprint ${r1.j.fp}; this checkout's file with its tags removed and spacing collapsed gives ${fpOf(LOCAL.full)}`);
const r2 = await call("submitNoDisclosure", "creator", "submit", [b2, PAGE.noDisclosure], { watch: ["sponsor"], expect: (j) => ({ sponsor: j?.mask === "unclear" ? SUBMIT_FEE : j?.status === "hidden_ad" ? FEE : 0n }) });
ok(`every validator reads no-disclosure.html for ${b2}: 0111, a hidden ad, the whole 0.9 GEN back to SPONSOR`, r2.applied && r2.j?.mask === "0111" && r2.j?.status === "hidden_ad" && r2.j?.to_sponsor === String(FEE) && r2.j?.held === "0" && moved(r2, "sponsor", FEE), `${votes(r2)}  ${JSON.stringify({ mask: r2.j?.mask, status: r2.j?.status, fp: r2.j?.fp })}`);
if (r2.j?.fp) note(`the stored fingerprint ${r2.j.fp}; this checkout's file gives ${fpOf(LOCAL.noDisclosure)}`);
const r3 = await call("submitNoLink", "creator", "submit", [b3, PAGE.noLink], { watch: ["sponsor"], expect: (j) => ({ sponsor: j?.mask === "unclear" ? SUBMIT_FEE : j?.mask === "1101" ? BACK_B3 : 0n }) });
ok(`every validator reads no-link.html for ${b3}: 1101, two of three lines, 0.6 GEN held and 0.3 GEN back to SPONSOR at once`, r3.applied && r3.j?.mask === "1101" && r3.j?.met === 2 && r3.j?.status === "held" && r3.j?.held === String(OWED_B3) && r3.j?.to_sponsor === String(BACK_B3) && moved(r3, "sponsor", BACK_B3), `${votes(r3)}  ${JSON.stringify({ mask: r3.j?.mask, held: r3.j?.held, fp: r3.j?.fp })}`);
if (r3.j?.fp) note(`the stored fingerprint ${r3.j.fp}; this checkout's file gives ${fpOf(LOCAL.noLink)}`);
const early = await call("releaseEarly", "stranger", "release", [b1], { watch: ["creator"], expect: { creator: 0n } });
ok(`nobody may release ${b1} before its hold ends`, refused(early, "the hold of " + b1 + " ends at") && moved(early, "creator", 0n), `${votes(early)}  ${early.msg.slice(0, 140)}`);
const look = await call("recheckB3", "stranger", "recheck", [b3], { watch: ["sponsor"], expect: { sponsor: 0n } });
ok(`STRANGER rechecks ${b3}: every validator fetches no-link.html again, still up, nothing moves`, look.applied && look.j?.up === "yes" && look.j?.status === "held" && look.j?.rechecks === 1 && moved(look, "sponsor", 0n), `${votes(look)}  ${look.msg.slice(0, 140)}`);

// ================================================================ phase C
console.log(`\n[${stamp()}] ---- phase C: the holds end on the chain's clock, and the held pay goes to the creator`);
const until1 = Number(r1.j?.hold_until || 0), until3 = Number(r3.j?.hold_until || 0);
if (!st.steps.releaseB1?.done) await untilChain(b1, until1, `the hold of ${b1} ends`);
const rel1 = await call("releaseB1", "stranger", "release", [b1], { watch: ["creator"], expect: { creator: FEE } });
ok(`STRANGER releases ${b1} once its hold has ended: 0.9 GEN to CREATOR`, rel1.j?.status === "released" && rel1.j?.to_creator === String(FEE) && moved(rel1, "creator", FEE), `${votes(rel1)}  ${rel1.msg.slice(0, 120)}`);
const lateLook = await call("recheckLate", "stranger", "recheck", [b1]);
ok(`a recheck of ${b1} after its pay was released is refused`, refused(lateLook, b1 + " is released; a post is rechecked while its pay is held"), `${votes(lateLook)}  ${lateLook.msg.slice(0, 120)}`);
if (!st.steps.releaseB3?.done) await untilChain(b3, until3, `the hold of ${b3} ends`);
const rel3 = await call("releaseB3", "stranger", "release", [b3], { watch: ["creator"], expect: { creator: OWED_B3 } });
ok(`STRANGER releases ${b3}: 0.6 GEN to CREATOR`, rel3.j?.status === "released" && rel3.j?.to_creator === String(OWED_B3) && moved(rel3, "creator", OWED_B3), `${votes(rel3)}  ${rel3.msg.slice(0, 120)}`);

// ================================================================ phase D
console.log(`\n[${stamp()}] ---- phase D: the code read back, the views, the credit, the balances`);
{
  const file = readFileSync(new URL("../../contracts/sponsored.py", import.meta.url));
  const chain = Buffer.from(String(await rpc("gen_getContractCode", [st.contract])), "base64");
  st.code = { address: st.contract, bytes: chain.length, sha256: sha(chain), file_bytes: file.length, file_sha256: sha(file), identical: Buffer.compare(chain, file) === 0 };
  save();
  ok(`the code deployed at ${st.contract} is byte for byte contracts/sponsored.py`, st.code.identical, `${chain.length} bytes, sha256 ${st.code.sha256}`);
  const v1 = await seen("brief1", "brief", [b1]);
  ok(`brief(${b1}) reads released on full.html with mask 1111 and the fingerprint the round stored`, v1.status === "released" && v1.mask === "1111" && v1.url === PAGE.full && v1.to_creator === String(FEE) && v1.held === "0" && v1.submissions?.[0]?.fp === r1.j?.fp, JSON.stringify({ status: v1.status, mask: v1.mask }));
  const v2 = await seen("brief2", "brief", [b2]);
  ok(`brief(${b2}) reads hidden_ad, the whole fee back to SPONSOR`, v2.status === "hidden_ad" && v2.mask === "0111" && v2.to_sponsor === String(FEE) && v2.to_creator === "0", JSON.stringify({ status: v2.status, mask: v2.mask }));
  const v3 = await seen("brief3", "brief", [b3]);
  ok(`brief(${b3}) reads released, 0.6 GEN to CREATOR and 0.3 GEN to SPONSOR, one recheck that found it up`, v3.status === "released" && v3.mask === "1101" && v3.met === 2 && v3.to_creator === String(OWED_B3) && v3.to_sponsor === String(BACK_B3) && v3.rechecks === 1 && v3.up === "yes", JSON.stringify({ status: v3.status, mask: v3.mask, rechecks: v3.rechecks }));
  const mine = await seen("briefsOfCreator", "briefs_of", [CREATOR.toUpperCase().replace("0X", "0x"), 0, 20]);
  ok("briefs_of(CREATOR) finds all three as creator, with the address in any letter case", mine.total === 3 && (mine.rows || []).every((r) => r.role === "creator"), JSON.stringify({ total: mine.total }));
  const stats = await seen("stats", "stats", []);
  ok("stats(): three briefs, two released, one hidden ad, three clear readings, one recheck, one refused payment returned", stats.briefs === 3 && stats.released === 2 && stats.hidden_ads === 1 && stats.clear === 3 && stats.unclear === 0 && stats.rechecks === 1 && stats.held === "0" && stats.to_creators === String(FEE + OWED_B3) && stats.to_sponsors === String(FEE + BACK_B3) && stats.refused_payments === 1, JSON.stringify(stats));
  const rules = await seen("rules", "rules", []);
  ok("rules() publishes the disclosure and the questions word for word, the comparison and the combine rule", rules.disclosure === DISCLOSURE && rules.submit?.askings?.[0] === "1, requirements as listed: " + QUESTION_MET && rules.submit?.askings?.[3] === "4, requirements reversed and renumbered: " + QUESTION_UNMET && String(rules.compared).includes("exact equality") && String(rules.submit?.combine?.mask).includes("exactly one of the two lists") && String(rules.submit?.page).includes("tags are removed"), "tags removed, spacing collapsed, 6,000 characters judged");
  const back = await call("withdrawCredit", "creator", "withdraw", [], { watch: ["creator"], expect: { creator: 5n * SUBMIT_FEE } });
  ok("CREATOR takes its 0.05 GEN of credit back: every reading was clear, so no fee was spent", back.j?.withdrawn === String(5n * SUBMIT_FEE) && moved(back, "creator", 5n * SUBMIT_FEE), `${votes(back)}  ${back.msg.slice(0, 100)}`);
  ok("the contract's own balance is zero", (await balance(st.contract)) === 0n, String(await balance(st.contract)));
  st.end = {}; for (const k of Object.keys(ROLES)) st.end[k] = String(await balance(acct[k].address));
  st.ended = new Date().toISOString(); save();
  const net = (k) => BigInt(st.end[k]) - BigInt(st.start[k]);
  const want = { sponsor: -(FEE + OWED_B3), creator: FEE + OWED_B3, stranger: 0n };
  ok("every account ends where the money says: SPONSOR down 1.5 GEN, CREATOR up 1.5 GEN, STRANGER whole", Object.keys(want).every((k) => net(k) === want[k]), Object.keys(want).map((k) => k.toUpperCase() + " " + Number(net(k)) / 1e18).join("  "));
}

st.checks = { pass, fail }; save();
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Sponsored: ${st.contract}  ${EXPLORER}/address/${st.contract}`);
console.log("transactions:", st.order.reduce((n, id) => n + st.steps[id].tries.length, 0), "in", st.order.length, "steps; sent a second time:", st.order.filter((id) => st.steps[id].tries.length > 1).join(", ") || "none");
for (const id of st.order) { const s = st.steps[id]; console.log(`${id.padEnd(19)} ${s.tries.map((t) => t.tx + " " + tally(t.votes) + " " + t.exec).join(" | ")}`); }
console.log("record:", RECORD);
process.exit(fail ? 1 : 0);
