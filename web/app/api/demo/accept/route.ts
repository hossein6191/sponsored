// POST /api/demo/accept {brief}: the demo creator accepts an offered brief made to it whose post prefix is
// its own pinned site. A brief to anyone else, or naming any other site, is refused. Rate-limited per
// brief and in total, one signature at a time; answers the transaction hash or why not. Nothing here ever
// logs or returns the key.

import { sendDemo } from "@/lib/demo-server";
import { parseBriefId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A read (retried while Studio is slow), perhaps a faucet payment, and one signature.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let id = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { brief?: unknown };
    id = typeof body.brief === "string" ? parseBriefId(body.brief) : "";
  } catch {
    id = "";
  }
  if (!id) return Response.json({ ok: false, reason: 'send {"brief": "B1"}' }, { status: 400, headers: noStore });
  const answer = await sendDemo(id, "accept");
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
