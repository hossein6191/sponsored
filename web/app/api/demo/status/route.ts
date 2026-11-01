// GET /api/demo/status: whether the demo creator can act now, its public address, its site, and exactly
// why not when it cannot: "no key set", "the key set is not a 0x private key of 64 hex characters", "the
// contract is not deployed yet", Studio's RPC not answering, or no GEN on its account. `posts` says
// whether the pinned addresses of its four posts can be built, `postsReason` why not, and `prefix` is
// its site as a brief's post prefix. The key itself is never echoed.

import { demoStatusNow } from "@/lib/demo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A balance read, and perhaps a faucet payment.
export const maxDuration = 60;

export async function GET() {
  return Response.json(await demoStatusNow(), { headers: { "cache-control": "no-store" } });
}
