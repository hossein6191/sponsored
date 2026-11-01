// Syne and DM Sans for the share card, fetched from Google Fonts when the card is built and cut down to
// the characters it prints. If the fetch fails the card is still built, in the renderer's own font.

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal" };

async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!resource) throw new Error("no font in the stylesheet");
  const res = await fetch(resource[1]);
  if (res.status !== 200) throw new Error("font fetch failed");
  return res.arrayBuffer();
}

export async function cardFonts(text: string): Promise<Font[]> {
  try {
    const [heading, body] = await Promise.all([loadGoogleFont("Syne", 800, text), loadGoogleFont("DM Sans", 500, text)]);
    return [
      { name: "Syne", data: heading, weight: 800, style: "normal" },
      { name: "DM Sans", data: body, weight: 500, style: "normal" },
    ];
  } catch {
    return [];
  }
}
