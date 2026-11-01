// Readies the demo creator (lib/demo-creator.ts) from its key, once: checks the key, funds the account
// from Studio's faucet when it holds less than a GEN, and deposits credit for submit fees so its first
// submissions need no deposit of their own. Run it by hand after the contract is deployed; nothing in the
// build runs it.
//
//   REGISTER=0x... DEMO_CREATOR_KEY=0x... node tools/open-demo-creator.mjs
//   DRY=1 REGISTER=0x... DEMO_CREATOR_KEY=0x... node tools/open-demo-creator.mjs    # check and print, send nothing
//   COMMIT=<40 hex> REPO=<owner>/<name> ...                                         # also check the posts are at that commit
//
// The key is a throwaway Studio test key, the same one the site's server holds in DEMO_CREATOR_KEY; it is
// read from the environment only and never printed. When COMMIT is given, every post the demo creator
// will submit is fetched from raw.githubusercontent.com and compared with posts/ in this checkout, so a
// wrong commit is caught before anyone relies on it (POSTS_COMMIT in lib/config.ts takes the same
// commit). Each transaction is followed to a final status. Needs Node 22.18 or later (it reads lib/*.ts
// directly).

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress } from "viem";

import { REPO_URL } from "../lib/config.ts";
import { cleanKey, keyProblem } from "../lib/demo-key.ts";
import { DEMO_POSTS, postsBase, prefixFits, repoOf } from "../lib/demo-creator.ts";
import { SUBMIT_FEE } from "../lib/rules.ts";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const studio = { ...studionet, rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC] } } };

const REGISTER = (process.env.REGISTER || "").trim();
const COMMIT = (process.env.COMMIT || "").trim();
const DRY = process.env.DRY === "1";
/** Credit to hold before the demo goes live: ten submissions. */
const WANT = SUBMIT_FEE * 10n;

function remoteRepo() {
  try {
    const origin = execSync("git remote get-url origin", { cwd: new URL("..", import.meta.url), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return (origin.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/) || [])[1] || "";
  } catch {
    return "";
  }
}
const REPO = (process.env.REPO || repoOf(REPO_URL) || remoteRepo()).trim();

const fail = (message) => {
  console.error(message);
  process.exit(2);
};
if (!/^0x[0-9a-fA-F]{40}$/.test(REGISTER)) fail("REGISTER must be the deployed contract's 0x address.");
if (COMMIT && !/^[0-9a-f]{40}$/.test(COMMIT)) fail("COMMIT, when given, must be the 40-character commit the posts were pushed in.");
const problem = keyProblem(process.env.DEMO_CREATOR_KEY);
if (problem) fail(`DEMO_CREATOR_KEY: ${problem}.`);
const account = createAccount(cleanKey(process.env.DEMO_CREATOR_KEY));
console.log(`demo creator ${account.address}`);

// ---- the posts the demo creator will submit must be at that commit -------------------------------------
if (COMMIT) {
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(REPO)) fail("REPO must be <owner>/<name> on GitHub (or set the git remote origin) when COMMIT is given.");
  const base = postsBase(REPO, COMMIT);
  if (!prefixFits(base)) fail(`${base} is longer than the 120 characters a post prefix may have; use a shorter repository name.`);
  for (const p of DEMO_POSTS) {
    const here = readFileSync(new URL(`../../posts/${p.file}`, import.meta.url), "utf8");
    let there = "";
    try {
      const r = await fetch(base + p.file);
      there = r.ok ? await r.text() : "";
    } catch {
      there = "";
    }
    if (there !== here) fail(`${base + p.file}\ndoes not serve posts/${p.file} as it is in this checkout. Push the repository and pass that commit as COMMIT.`);
  }
  console.log(`the ${DEMO_POSTS.length} posts are at ${base}; set POSTS_COMMIT = "${COMMIT}" in lib/config.ts`);
} else console.log("COMMIT not given: the posts were not checked. The demo creator acts only once POSTS_COMMIT is set in lib/config.ts.");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) {
        await sleep(res.status === 429 || body.error.code === -32029 ? 20_000 : 5000);
        continue;
      }
      return body.result;
    } catch {
      await sleep(4000);
    }
  }
  throw new Error(`${method} did not answer`);
}

/** Follows a transaction to a final status; returns the contract's JSON return and the vote tally. */
async function follow(hash) {
  for (let i = 0; i < 300; i++) {
    await sleep(4000);
    const tx = await rpc("eth_getTransactionByHash", [hash]);
    const status = String(tx?.status ?? "");
    if (status === "FINALIZED" || status === "CANCELED" || status === "UNDETERMINED") {
      const lr = tx.consensus_data?.leader_receipt;
      const one = Array.isArray(lr) ? lr[0] : lr;
      let text = "";
      try {
        text = Buffer.from(one?.result ?? "", "base64").toString("utf8");
      } catch {
        text = "";
      }
      const start = text.indexOf("{");
      let json = null;
      try {
        json = start >= 0 ? JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)) : null;
      } catch {
        json = null;
      }
      const votes = Object.values(tx.consensus_data?.votes ?? {});
      return { status, json, agree: votes.filter((v) => v === "agree").length, of: votes.length };
    }
  }
  return { status: "TIMEOUT", json: null, agree: 0, of: 0 };
}

const client = createClient({ chain: studio, account });

async function readCredit() {
  for (let i = 0; i < 8; i++) {
    try {
      const raw = await client.readContract({ address: REGISTER, functionName: "credit", args: [account.address.toLowerCase()] });
      const v = typeof raw === "string" ? JSON.parse(raw) : raw;
      return BigInt(v.credit ?? "0");
    } catch {
      await sleep(5000);
    }
  }
  throw new Error("could not read credit() from Studio");
}

// The key signs from its own balance; Studio's faucet tops it up when it holds less than a GEN.
const have = BigInt((await rpc("eth_getBalance", [account.address, "latest"])) || "0x0");
console.log(`balance ${have} atto`);
if (have < 10n ** 18n) {
  if (DRY) console.log("DRY RUN: would ask the faucet for 20 GEN");
  else {
    await rpc("sim_fundAccount", { account_address: getAddress(account.address), amount: 20e18 });
    for (let i = 0; i < 20 && BigInt((await rpc("eth_getBalance", [account.address, "latest"])) || "0x0") <= have; i++) await sleep(3000);
    console.log("funded from the faucet");
  }
}

const credit = await readCredit();
console.log(`credit ${credit} atto (${credit / SUBMIT_FEE} submissions)`);
if (credit >= WANT) {
  console.log("SKIP  deposit: the demo creator already holds enough credit.");
  process.exit(0);
}
const top = WANT - credit;
if (DRY) {
  console.log(`DRY RUN: deposit() with ${top} atto to ${REGISTER}`);
  process.exit(0);
}
const hash = await client.writeContract({ address: REGISTER, functionName: "deposit", args: [], value: top });
const sent = await follow(hash);
const ok = sent.json?.ok === true;
console.log(`${ok ? "OK  " : "FAIL"}  deposit: ${ok ? sent.json.credit + " atto of credit" : sent.status}  ${sent.agree}/${sent.of} agree  ${EXPLORER}/tx/${hash}`);
if (!ok) process.exit(1);
console.log("\nThe demo creator is ready. Set DEMO_CREATOR_KEY on the host and check GET /api/demo/status.");
