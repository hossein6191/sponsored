// POST /api/demo/post {brief, page}: the demo creator submits ONE of its four fixed posts on an accepted
// brief made to it: "full", "no-disclosure", "no-link" or "wrong-product", each a page in posts/ pinned to
// one commit of the public repository. The page is a key into that list and nothing else; no text from
// the visitor is ever signed. When its credit for submit fees has run out it deposits a few submissions'
// worth first. One move at a time per brief, rate-limited; answers the transaction hash or why not.
// Nothing here ever logs or returns the key.

import { POST_KEYS } from "@/lib/demo-creator";
import { sendDemo } from "@/lib/demo-server";
import { parseBriefId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Two reads, perhaps a deposit that must land first, and one signature.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let id = "";
  let page = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { brief?: unknown; page?: unknown };
    id = typeof body.brief === "string" ? parseBriefId(body.brief) : "";
    page = typeof body.page === "string" && (POST_KEYS as string[]).includes(body.page) ? body.page : "";
  } catch {
    id = "";
  }
  if (!id || !page) return Response.json({ ok: false, reason: `send {"brief": "B1", "page": one of ${POST_KEYS.join(", ")}}` }, { status: 400, headers: noStore });
  const answer = await sendDemo(id, page);
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
