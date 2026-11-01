// The mark: a phone with a mint check on its screen and a small tomato "ad" tag clipped to its corner.
// One drawing, used by the header (components/logo.tsx draws the same shapes in JSX), the tab icon
// (app/icon.svg), the home-screen icon and the share card (as a data URI). Pure; the "ad" is drawn as
// strokes, not text, so it renders without a font.

export const CREAM = "#FAF7F2";
export const INK = "#1B1F3B";
export const TOMATO = "#FF5A36";
export const MINT = "#3DDC97";

/** The mark's inner shapes on a 64-unit square, without the outer <svg>. */
export const MARK_SHAPES = [
  `<rect x="13" y="7" width="32" height="52" rx="8.5" fill="${INK}"/>`,
  `<rect x="17" y="13" width="24" height="39" rx="3.5" fill="${CREAM}"/>`,
  `<rect x="25.5" y="9.4" width="7" height="1.8" rx="0.9" fill="${CREAM}" opacity="0.55"/>`,
  `<path d="M21.6 32.6 L27.4 38.4 L36.8 27" fill="none" stroke="${MINT}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  `<g transform="translate(46 14) rotate(-14)">`,
  `<rect x="-12.5" y="-6.8" width="25" height="13.6" rx="4" fill="${TOMATO}" stroke="${CREAM}" stroke-width="2"/>`,
  `<circle cx="-8.6" cy="0" r="1.25" fill="${CREAM}"/>`,
  `<circle cx="-2.6" cy="0.9" r="2.3" fill="none" stroke="#fff" stroke-width="1.7"/>`,
  `<path d="M-0.3 -1.6 V3.3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
  `<circle cx="4.2" cy="0.9" r="2.3" fill="none" stroke="#fff" stroke-width="1.7"/>`,
  `<path d="M6.5 -4.1 V3.3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
  `</g>`,
].join("");

/** The whole mark as an SVG document, optionally on a cream tile with rounded corners. */
export function markSvg(opts: { size?: number; tile?: boolean } = {}): string {
  const size = opts.size ?? 64;
  const tile = opts.tile ? `<rect width="64" height="64" rx="14" fill="${CREAM}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${tile}${MARK_SHAPES}</svg>`;
}

/** The mark as a data URI, for an <img> in an ImageResponse. */
export const markDataUri = (opts: { size?: number; tile?: boolean } = {}): string => "data:image/svg+xml;base64," + Buffer.from(markSvg(opts)).toString("base64");
