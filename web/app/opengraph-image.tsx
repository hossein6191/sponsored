import { ImageResponse } from "next/og";

import { SITE_TAGLINE } from "@/lib/config";
import { CREAM, INK, MINT, TOMATO, markDataUri } from "@/lib/mark";
import { cardFonts } from "@/lib/og-fonts";

export const alt = "Sponsored: a sponsored post paid only for what it actually shows. Validators read the post against the brief; a hidden ad is not paid.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "Sponsored";
const LINE = SITE_TAGLINE;
const SUB = "Validators read the post on the live web, line by line. A hidden ad is not paid.";
const ROWS: { text: string; met: boolean; ad?: boolean }[] = [
  { text: "Says it is sponsored", met: true, ad: true },
  { text: "Names the 20 L dry bag", met: true },
  { text: "Links to the shop", met: false },
  { text: "Mentions orange", met: true },
];

// The share card: the cream canvas, the phone with the post in it, and the brief as a checklist laid
// over it, three lines lit mint and one left tomato, with two thirds of the fee held.
export default async function OpenGraphImage() {
  const fonts = await cardFonts(TITLE + LINE + SUB + ROWS.map((r) => r.text).join("") + "#ad0123456789.GEN heldHarbourEats");
  const heading = fonts.length ? "Syne" : "sans-serif";
  const body = fonts.length ? "DM Sans" : "sans-serif";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: CREAM, fontFamily: body }}>
        <div style={{ position: "absolute", right: -80, top: -120, width: 520, height: 520, borderRadius: 999, backgroundColor: "#FFE6DE" }} />
        <div style={{ position: "absolute", right: 260, bottom: -160, width: 360, height: 360, borderRadius: 999, backgroundColor: "#DBF6E9" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 70px", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={markDataUri({ size: 76 })} width={76} height={76} alt="" />
            <div style={{ fontSize: 50, fontWeight: 800, color: INK, fontFamily: heading, letterSpacing: -1 }}>{TITLE}</div>
          </div>
          <div style={{ marginTop: 30, fontSize: 56, fontWeight: 800, lineHeight: 1.04, color: INK, fontFamily: heading, letterSpacing: -1.5 }}>{LINE}</div>
          <div style={{ marginTop: 22, fontSize: 25, color: "#474B67", lineHeight: 1.35 }}>{SUB}</div>
          <div style={{ display: "flex", marginTop: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 8px 8px 24px", borderRadius: 999, backgroundColor: TOMATO, border: `3px solid ${INK}`, color: "#fff", fontSize: 22, fontFamily: heading, fontWeight: 800 }}>
              Open a brief
              <div style={{ display: "flex", width: 40, height: 40, borderRadius: 999, backgroundColor: INK }} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 560, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 270, height: 520, borderRadius: 46, backgroundColor: INK, padding: 11, transform: "rotate(-5deg)", marginLeft: -60 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 36, backgroundColor: "#fff", padding: "40px 18px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: TOMATO }} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Harbour Eats</div>
                  <div style={{ width: 80, height: 8, borderRadius: 4, backgroundColor: "#E8E2D7", marginTop: 4 }} />
                </div>
              </div>
              <div style={{ display: "flex", height: 120, marginTop: 14, borderRadius: 14, backgroundColor: "#3A8FB0", position: "relative" }}>
                <div style={{ position: "absolute", left: 92, top: 30, width: 46, height: 62, borderRadius: 12, backgroundColor: "#FF7A2E", border: `2px solid ${INK}` }} />
              </div>
              {[100, 92, 96, 70, 88, 60].map((w, i) => (
                <div key={i} style={{ width: `${w}%`, height: 9, borderRadius: 5, backgroundColor: i === 0 ? INK : "#E8E2D7", marginTop: 12 }} />
              ))}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              right: 30,
              top: 150,
              display: "flex",
              flexDirection: "column",
              width: 330,
              padding: 18,
              borderRadius: 24,
              backgroundColor: "#fff",
              border: `3px solid ${INK}`,
              boxShadow: "0 24px 40px -24px rgba(27,31,59,0.6)",
            }}
          >
            {ROWS.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginTop: i ? 8 : 0, borderRadius: 16, backgroundColor: r.met ? "#DBF6E9" : "#FFE6DE" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 999, backgroundColor: r.met ? MINT : TOMATO, border: `2px solid ${INK}`, color: r.met ? INK : "#fff", fontSize: 18, fontWeight: 800 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={r.met ? INK : "#fff"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={r.met ? "M5 12.5l4.5 4.5L19 7.5" : "M6.5 6.5l11 11M17.5 6.5l-11 11"} />
                  </svg>
                </div>
                {r.ad && <div style={{ display: "flex", padding: "2px 8px", borderRadius: 999, backgroundColor: INK, color: "#fff", fontSize: 14, fontWeight: 700 }}>#ad</div>}
                <div style={{ fontSize: 19, color: INK, fontWeight: 500 }}>{r.text}</div>
              </div>
            ))}
            <div style={{ display: "flex", marginTop: 14, height: 14, borderRadius: 999, backgroundColor: "#F2EDE4", border: `2px solid ${INK}` }}>
              <div style={{ width: "66%", height: "100%", borderRadius: 999, backgroundColor: MINT }} />
            </div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 16, color: "#474B67" }}>0.6 GEN held for the creator</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
