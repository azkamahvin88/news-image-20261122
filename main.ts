// Sunday 22 November 2026 — The World in One Day
// A one-page newspaper front page rendered from scratch in pure TypeScript:
// a small software rasterizer, a hand-written 5x7 bitmap font and a tiny
// PNG writer (zlib from the Node standard library). No network, no assets,
// no randomness: every run writes byte-identical output.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PAGE_W = 1024;
const PAGE_H = 1024;

type Colour = [number, number, number];

// ---- palette: cream newsprint, black serif ink, maroon + navy accents ----
const CREAM: Colour = [246, 241, 229];
const PAPER: Colour = [252, 249, 240];
const INK: Colour = [22, 22, 22];
const MAROON: Colour = [150, 26, 26];
const MAROON_DK: Colour = [112, 18, 18];
const NAVY: Colour = [26, 44, 82];
const STEEL: Colour = [56, 106, 160];
const SKY: Colour = [203, 224, 236];
const LEAF: Colour = [86, 138, 86];
const FIELD: Colour = [176, 203, 156];
const AMBER: Colour = [198, 146, 40];
const EMBER: Colour = [221, 108, 28];
const MUTE: Colour = [118, 116, 108];
const SNOW: Colour = [255, 255, 255];
const RIVER: Colour = [50, 94, 138];
const SAND: Colour = [212, 194, 148];

// ---- 5x7 bitmap font. Every glyph is 7 rows of 5 bits, top to bottom. ----
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10000", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01000", "01110", "01000", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "00010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "11110", "10001", "10001", "11110", "10000", "10000"],
  q: ["00000", "00000", "01111", "10001", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "01110", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "01110", "00000", "01110", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "€": ["01110", "10001", "11110", "10000", "11110", "10001", "01110"],
};

// ---- the pixel canvas ----
const canvas = Buffer.alloc(PAGE_W * PAGE_H * 3);
function setPixel(x: number, y: number, c: Colour): void {
  if (x < 0 || y < 0 || x >= PAGE_W || y >= PAGE_H) return;
  const i = (y * PAGE_W + x) * 3;
  canvas[i] = c[0]; canvas[i + 1] = c[1]; canvas[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: Colour): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPixel(i, j, c);
}
function drawHLine(x0: number, x1: number, y: number, c: Colour, t = 1): void {
  for (let k = 0; k < t; k++) for (let i = x0; i <= x1; i++) setPixel(i, y + k, c);
}
function drawVLine(x: number, y0: number, y1: number, c: Colour, t = 1): void {
  for (let k = 0; k < t; k++) for (let j = y0; j <= y1; j++) setPixel(x + k, j, c);
}
function drawLine(x0: number, y0: number, x1: number, y1: number, c: Colour, t = 1): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let n = 0; n < 5000; n++) {
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) setPixel(x + a, y + b, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function drawDisc(cx: number, cy: number, r: number, c: Colour): void {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
    if (i * i + j * j <= r * r) setPixel(cx + i, cy + j, c);
}
function drawRing(cx: number, cy: number, r: number, c: Colour, t = 2): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++)
      setPixel(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
  }
}
function drawTri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Colour): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let j = minY; j <= maxY; j++) for (let i = minX; i <= maxX; i++) {
    const a = ((y1 - y2) * (i - x2) + (x2 - x1) * (j - y2)) / d;
    const b = ((y2 - y0) * (i - x2) + (x0 - x2) * (j - y2)) / d;
    if (a >= 0 && b >= 0 && a + b <= 1) setPixel(i, j, c);
  }
}
function fillPoly(pts: [number, number][], c: Colour): void {
  let minY = 1e9, maxY = -1e9;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let j = minY; j <= maxY; j++) {
    const xs: number[] = [];
    for (let k = 0; k < pts.length; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % pts.length];
      if ((y0 <= j && y1 > j) || (y1 <= j && y0 > j))
        xs.push(Math.round(x0 + ((j - y0) / (y1 - y0)) * (x1 - x0)));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let i = xs[k]; i <= xs[k + 1]; i++) setPixel(i, j, c);
  }
}
function drawBox(x: number, y: number, w: number, h: number, c: Colour, t = 1): void {
  drawHLine(x, x + w - 1, y, c, t);
  drawHLine(x, x + w - 1, y + h - t, c, t);
  drawVLine(x, y, y + h - 1, c, t);
  drawVLine(x + w - t, y, y + h - 1, c, t);
}

// ---- text rendering ----
function measure(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawString(x: number, y: number, s: string, scale: number, c: Colour, bold = false): void {
  let cx = x;
  for (const ch of s) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") {
          fillRect(cx + col * scale, y + r * scale, scale, scale, c);
          if (bold) fillRect(cx + col * scale + 1, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (measure(test, scale) <= maxW || !cur) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawBlock(x: number, y: number, s: string, maxW: number, scale: number, c: Colour, lh: number, bold = false): number {
  const lines = wrapText(s, maxW, scale);
  for (let i = 0; i < lines.length; i++) drawString(x, y + i * lh, lines[i], scale, c, bold);
  return y + lines.length * lh;
}
function drawCentred(y: number, s: string, scale: number, c: Colour, bold = false): void {
  drawString(Math.round((PAGE_W - measure(s, scale)) / 2), y, s, scale, c, bold);
}
function drawBadge(cx: number, cy: number, n: number, r = 9): void {
  drawDisc(cx, cy, r, MAROON);
  const s = String(n);
  drawString(cx - Math.round(measure(s, 1) / 2), cy - 4, s, 1, SNOW, true);
}

// ---- lead illustrations (flat, original drawings for 22 Nov) ----
function artGulf(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  const stars: [number, number][] = [[18, 12], [64, 20], [118, 9], [176, 16], [238, 10], [292, 22], [96, 32], [214, 34], [158, 11], [262, 40]];
  for (const [sx, sy] of stars) setPixel(x + sx, y + sy, SNOW);
  drawDisc(x + 270, y + 14, 8, [238, 228, 188]);
  // falling interceptor: bright trail down to the sea
  drawLine(x + 150, y + 6, x + 138, y + 58, [255, 214, 140], 2);
  drawLine(x + 240, y + 10, x + 252, y + 50, [255, 214, 140], 2);
  // blast on the water
  const blast = (bx: number, by: number, r: number) => {
    drawDisc(bx, by, r, EMBER); drawDisc(bx, by, Math.round(r * 0.55), AMBER);
    drawTri(bx - r - 5, by, bx, by - r - 7, bx + r + 5, by, AMBER);
  };
  blast(x + 136, y + 62, 10); blast(x + 254, y + 56, 8);
  // sea
  fillRect(x, y + h - 22, w, 22, RIVER);
  drawHLine(x + 10, x + 90, y + h - 12, SNOW, 1);
  drawHLine(x + 190, x + 300, y + h - 8, SNOW, 1);
  // Bahrain towers on the horizon
  fillRect(x + 16, y + h - 46, 14, 24, [14, 24, 50]);
  fillRect(x + 36, y + h - 56, 10, 34, [14, 24, 50]);
  drawTri(x + 36, y + h - 62, x + 46, y + h - 62, x + 41, y + h - 72, [14, 24, 50]);
  fillRect(x + 268, y + h - 42, 18, 20, [14, 24, 50]);
  // small warning beacon
  drawDisc(x + 296, y + h - 34, 4, MAROON);
}

function artSummit(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, PAPER);
  drawBox(x, y, w, h, MUTE, 1);
  // three flag panels: USA, China, Russia
  const fw = 92, fh = 52, fy = y + 10;
  // USA
  const ux = x + 12;
  fillRect(ux, fy, fw, fh, SNOW);
  for (let s = 0; s < 7; s++) fillRect(ux, fy + s * 8, fw, 4, MAROON);
  fillRect(ux, fy, 38, 28, NAVY);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) setPixel(ux + 4 + c * 7, fy + 4 + r * 6, SNOW);
  // China
  const cx = x + 114;
  fillRect(cx, fy, fw, fh, MAROON);
  drawDisc(cx + 18, fy + 14, 5, AMBER);
  drawDisc(cx + 38, fy + 8, 2, AMBER); drawDisc(cx + 44, fy + 16, 2, AMBER);
  drawDisc(cx + 38, fy + 24, 2, AMBER); drawDisc(cx + 30, fy + 28, 2, AMBER);
  // Russia
  const rx = x + 216;
  fillRect(rx, fy, fw, 17, SNOW);
  fillRect(rx, fy + 17, fw, 18, STEEL);
  fillRect(rx, fy + 35, fw, 17, MAROON);
  // flag poles
  drawVLine(ux + 46, fy + fh, fy + fh + 8, INK, 2);
  drawVLine(cx + 46, fy + fh, fy + fh + 8, INK, 2);
  drawVLine(rx + 46, fy + fh, fy + fh + 8, INK, 2);
  // Shenzhen skyline below
  fillRect(x + 20, y + h - 30, 26, 30, NAVY);
  fillRect(x + 56, y + h - 38, 18, 38, NAVY);
  drawTri(x + 56, y + h - 48, x + 74, y + h - 48, x + 65, y + h - 58, NAVY);
  fillRect(x + 240, y + h - 34, 22, 34, NAVY);
  fillRect(x + 272, y + h - 26, 16, 26, NAVY);
  drawString(x + 96, y + h - 22, "SHENZHEN", 1, INK, true);
}

function artEuArms(x: number, y: number, w: number, h: number): void {
  // EU blue field with the circle of stars, Ukrainian bands on the right
  fillRect(x, y, w, h, [24, 54, 120]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    drawDisc(Math.round(x + 78 + 34 * Math.cos(a)), Math.round(y + 52 + 34 * Math.sin(a)), 3, AMBER);
  }
  fillRect(x + 150, y + 16, 150, 28, [40, 110, 200]);
  fillRect(x + 150, y + 44, 150, 28, AMBER);
  drawString(x + 158, y + 30, "UKRAINE", 2, SNOW, true);
  drawString(x + 20, y + h - 26, "€1bn", 3, AMBER, true);
  drawString(x + 118, y + h - 20, "MORE MILITARY AID", 1, SNOW, true);
}

// ---- small icons, one per small story (192 x 44) ----
function iconEstonia(x: number, y: number): void {
  fillRect(x + 8, y + 4, 84, 12, STEEL);
  fillRect(x + 8, y + 16, 84, 12, INK);
  fillRect(x + 8, y + 28, 84, 12, SNOW);
  drawBox(x + 8, y + 4, 84, 36, INK, 1);
  // closed gate bars
  for (let i = 0; i < 5; i++) drawVLine(x + 112 + i * 14, y + 6, y + 38, MAROON, 3);
  drawHLine(x + 110, x + 180, y + 10, MAROON, 3);
  drawHLine(x + 110, x + 180, y + 34, MAROON, 3);
}
function iconMexico(x: number, y: number): void {
  fillRect(x, y, 192, 44, [238, 222, 180]);
  drawDisc(x + 34, y + 14, 9, AMBER);
  fillPoly([[x + 60, y + 44], [x + 90, y + 14], [x + 120, y + 44]], [150, 110, 70]);
  fillPoly([[x + 110, y + 44], [x + 150, y + 22], [x + 190, y + 44]], [120, 88, 54]);
  // cactus
  fillRect(x + 150, y + 20, 6, 24, LEAF);
  fillRect(x + 142, y + 26, 8, 4, LEAF); fillRect(x + 156, y + 30, 8, 4, LEAF);
  drawString(x + 8, y + 30, "SINALOA", 1, MAROON_DK, true);
}
function iconLebanon(x: number, y: number): void {
  fillRect(x + 8, y + 4, 84, 36, SNOW);
  drawBox(x + 8, y + 4, 84, 36, MUTE, 1);
  fillRect(x + 8, y + 4, 84, 7, MAROON);
  fillRect(x + 8, y + 33, 84, 7, MAROON);
  // cedar
  drawTri(x + 50, y + 8, x + 38, y + 22, x + 62, y + 22, LEAF);
  drawTri(x + 50, y + 14, x + 36, y + 28, x + 64, y + 28, LEAF);
  fillRect(x + 48, y + 28, 4, 8, [110, 76, 40]);
  // UN blue helmet
  drawDisc(x + 150, y + 22, 16, STEEL);
  fillRect(x + 126, y + 22, 48, 4, STEEL);
  drawString(x + 128, y + 32, "UNIFIL", 1, SNOW, true);
}
function iconGaza(x: number, y: number): void {
  fillRect(x, y, 192, 44, [232, 228, 214]);
  // broken wall
  fillRect(x + 8, y + 10, 70, 10, [150, 142, 126]);
  fillRect(x + 8, y + 24, 46, 10, [150, 142, 126]);
  fillRect(x + 8, y + 38, 60, 6, [150, 142, 126]);
  // olive branch
  drawLine(x + 100, y + 38, x + 150, y + 8, LEAF, 2);
  for (const [lx, ly] of [[112, 30], [124, 22], [136, 15], [146, 10]] as [number, number][])
    drawDisc(x + lx, y + ly, 4, LEAF);
  drawDisc(x + 168, y + 14, 6, SNOW);
  drawString(x + 160, y + 26, "CEASEFIRE", 1, MAROON, true);
}
function iconCop(x: number, y: number): void {
  drawDisc(x + 40, y + 22, 19, STEEL);
  fillPoly([[x + 30, y + 8], [x + 48, y + 14], [x + 44, y + 30], [x + 28, y + 28]], LEAF);
  fillPoly([[x + 48, y + 30], [x + 56, y + 38], [x + 42, y + 42]], LEAF);
  fillRect(x + 96, y + 6, 88, 32, [230, 238, 218]);
  drawString(x + 104, y + 12, "FINAL DAY", 1, MAROON, true);
  drawString(x + 104, y + 24, "NO DEAL YET", 1, INK, true);
}
function iconBrazil(x: number, y: number): void {
  fillRect(x + 8, y + 4, 84, 36, LEAF);
  fillPoly([[x + 50, y + 8], [x + 88, y + 22], [x + 50, y + 36], [x + 12, y + 22]], AMBER);
  drawDisc(x + 50, y + 22, 8, STEEL);
  // hospital cross
  drawDisc(x + 150, y + 22, 17, SNOW);
  drawBox(x + 133, y + 5, 34, 34, MUTE, 1);
  fillRect(x + 145, y + 10, 10, 24, MAROON);
  fillRect(x + 138, y + 17, 24, 10, MAROON);
}
function iconIndia(x: number, y: number): void {
  // bridge arc over the river
  fillRect(x, y, 192, 44, [226, 238, 244]);
  drawLine(x + 8, y + 36, x + 96, y + 8, MAROON, 3);
  drawLine(x + 96, y + 8, x + 184, y + 36, MAROON, 3);
  drawVLine(x + 40, y + 26, y + 40, INK, 2);
  drawVLine(x + 96, y + 8, y + 40, INK, 2);
  drawVLine(x + 152, y + 26, y + 40, INK, 2);
  fillRect(x, y + 40, 192, 4, RIVER);
  drawString(x + 60, y + 14, "NITISH SETU", 1, INK, true);
}
function iconJapanIndia(x: number, y: number): void {
  fillRect(x + 8, y + 6, 80, 32, SNOW);
  drawBox(x + 8, y + 6, 80, 32, MUTE, 1);
  drawDisc(x + 48, y + 22, 10, MAROON);
  fillRect(x + 104, y + 6, 80, 11, [255, 153, 51]);
  fillRect(x + 104, y + 17, 80, 10, SNOW);
  fillRect(x + 104, y + 27, 80, 11, [19, 136, 8]);
  drawDisc(x + 144, y + 22, 4, NAVY);
}
function iconMarkets(x: number, y: number): void {
  fillRect(x, y, 192, 44, PAPER);
  drawBox(x, y, 192, 44, MUTE, 1);
  const bars = [34, 28, 30, 20, 14, 8];
  for (let i = 0; i < bars.length; i++) {
    const bx = x + 16 + i * 26;
    fillRect(bx, y + 38 - bars[i], 16, bars[i], i < 3 ? [198, 88, 78] : MAROON);
  }
  drawLine(x + 12, y + 8, x + 178, y + 34, MAROON, 2);
  drawString(x + 12, y + 4, "-3%", 1, MAROON, true);
}
function iconSport(x: number, y: number): void {
  fillRect(x + 24, y + 4, 12, 34, [188, 158, 108]);
  drawLine(x + 30, y + 38, x + 58, y + 12, [188, 158, 108], 4);
  drawDisc(x + 116, y + 20, 11, MAROON);
  drawHLine(x + 105, x + 127, y + 20, [255, 198, 198], 1);
  drawString(x + 140, y + 12, "CAPTAIN", 1, INK, true);
  drawString(x + 140, y + 24, "KEPT", 1, INK, true);
  // stumps
  for (let i = 0; i < 3; i++) fillRect(x + 160 + i * 6, y + 30, 3, 12, AMBER);
}

// ---- world map (schematic) with numbered pins ----
function drawWorldMap(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  drawBox(x, y, w, h, MUTE, 1);
  fillPoly([[x + 20, y + 40], [x + 110, y + 26], [x + 150, y + 48], [x + 120, y + 86], [x + 70, y + 92], [x + 30, y + 70]], FIELD); // N America
  fillPoly([[x + 90, y + 100], [x + 140, y + 96], [x + 150, y + 130], [x + 120, y + 158], [x + 96, y + 128]], FIELD); // S America
  fillPoly([[x + 215, y + 30], [x + 250, y + 22], [x + 268, y + 44], [x + 250, y + 62], [x + 222, y + 56]], FIELD); // Europe
  fillPoly([[x + 225, y + 66], [x + 268, y + 62], [x + 285, y + 92], [x + 262, y + 128], [x + 236, y + 104]], FIELD); // Africa
  fillPoly([[x + 290, y + 24], [x + 420, y + 16], [x + 445, y + 52], [x + 400, y + 96], [x + 330, y + 88], [x + 300, y + 58]], FIELD); // Asia
  fillPoly([[x + 385, y + 128], [x + 425, y + 124], [x + 430, y + 148], [x + 395, y + 152]], FIELD); // Australia
  const pin = (lat: number, lon: number, n: number, dx = 0, dy = 0) => {
    const tx = x + Math.round(((lon + 180) / 360) * w);
    const ty = y + Math.round(((90 - lat) / 180) * h);
    const bx = tx + dx, by = ty + dy;
    if (dx !== 0 || dy !== 0) drawLine(tx, ty, bx, by, MAROON, 1);
    drawDisc(tx, ty, 2, MAROON);
    drawBadge(bx, by, n, 7);
  };
  pin(50.9, 4.4, 3);        // Brussels
  pin(59.4, 24.7, 4, 14, -12); // Estonia, badge lifted clear of Brussels
  pin(51.5, -0.1, 12, -14, 8); // London (markets), badge pulled left
  pin(36.9, 30.7, 8, 0, -20); // Antalya (COP31), badge above the cluster
  pin(33.9, 35.5, 6, -20, 2); // Lebanon, badge pulled left
  pin(31.5, 34.5, 7, 16, 12);  // Gaza, badge pushed down-right
  pin(26.2, 50.6, 1, 14, 8);  // Bahrain, badge pushed right
  pin(25.6, 85.1, 10);      // Patna
  pin(22.5, 114.1, 2);      // Shenzhen
  pin(35.7, 139.7, 11);     // Tokyo
  pin(24.8, -107.4, 5);     // Sinaloa
  pin(-15.8, -47.9, 9);     // Brasilia
  pin(-35.3, 149.1, 13);    // Canberra
}

// ---- the 35 stories: every one happened, or was first reported, on Sun 22 Nov 2026 ----
type Story = { n: number; tag: string; head: string; body: string; src: string };
const LEADS: Story[] = [
  { n: 1, tag: "GULF · MIDDLE EAST", head: "Gulf on edge: Patriot falls in Bahrain",
    body: "Bahrain probes a fallen Patriot interceptor amid fresh drone attack reports; Iran calls the Qeshm blast a US ammo dump; US reissues security alerts.",
    src: "Times of India" },
  { n: 2, tag: "SHENZHEN · SUMMIT", head: "Trump in Shenzhen for APEC summit",
    body: "Trilateral talks with Xi and Putin scheduled; Trump calls China's nuclear build-up rapid and concerning; an Iran deal could last 20 years.",
    src: "Times of India" },
  { n: 3, tag: "BRUSSELS · EUROPE", head: "EU sends EUR 1bn more arms to Ukraine",
    body: "The EU channels EUR 1 billion in extra military aid to Ukraine; Denmark expels a Russian diplomat over an alleged plot to kill a Ukrainian rapper.",
    src: "Reuters" },
];
const SMALLS: Story[] = [
  { n: 4, tag: "TALLINN · EUROPE", head: "Estonia shuts border with Russia",
    body: "Moscow calls it a new Iron Curtain.", src: "Reuters" },
  { n: 5, tag: "SINALOA · MEXICO", head: "Cartel boss El Chapo Isidro captured",
    body: "4 soldiers and 7 gunmen killed; 11 dead in Sinaloa clashes.", src: "Reuters" },
  { n: 6, tag: "BEIRUT · LEBANON", head: "UNIFIL hands south Lebanon to army",
    body: "UN force starts transfer of control to Lebanese troops.", src: "Reuters" },
  { n: 7, tag: "GAZA · MIDDLE EAST", head: "4 killed in Gaza ceasefire violations",
    body: "14 wounded as Israel breaches the truce, medics say.", src: "Reuters" },
  { n: 8, tag: "ANTALYA · COP31", head: "COP31 nears final resolution",
    body: "AI pledge fails to draw big US tech firms, chair says.", src: "Reuters" },
  { n: 9, tag: "BRASILIA · BRAZIL", head: "Bolsonaro in ICU with bowel blockage",
    body: "Jailed ex-president in intensive care, doctors say.", src: "Reuters" },
  { n: 10, tag: "PATNA · INDIA", head: "Modi opens Nitish Setu bridge",
    body: "Patna-Vaishali link opens; 14 Ranchi flights axed.", src: "Times of India" },
  { n: 11, tag: "TOKYO · JAPAN-INDIA", head: "Japan troops to train in India first",
    body: "Japanese forces to use Indian ranges for live-fire drills.", src: "Reuters" },
  { n: 12, tag: "MARKETS · GLOBAL", head: "Crude oil slides over 3%",
    body: "Sensex ends two-day rally on Fed rate worries.", src: "Times of India" },
  { n: 13, tag: "CRICKET · AUSTRALIA", head: "Cummins keeps Australia Test job",
    body: "Unanimous Cricket Australia backing for the captain.", src: "AP" },
];
const ALSO: { n: number; line: string }[] = [
  { n: 14, line: "US-Canada: Hegseth sets new defence ties limit (Reuters)" },
  { n: 15, line: "US: economic pressure on Iran grows; nuclear consensus (Reuters)" },
  { n: 16, line: "France seeks UN Security Council action on Myanmar (Reuters)" },
  { n: 17, line: "Saudi-led coalition downs 3 Houthi missiles for Riyadh (Reuters)" },
  { n: 18, line: "Zelensky: new peace talks could be held at G20 summit (Reuters)" },
  { n: 19, line: "N. Gupta gets 19 years in US over Pannun murder plot (Reuters)" },
  { n: 20, line: "EU chief proposes 2028-2034 budget cuts, digital tax (Reuters)" },
  { n: 21, line: "Iraq: Basra power plant fire kills 4, hurts 35 (Reuters)" },
  { n: 22, line: "S. Korea offers $75,000 bounty for exam cheating tips (Yonhap)" },
  { n: 23, line: "Israel: Eisenkot invites Netanyahu Likud to coalition talks (AP)" },
  { n: 24, line: "France probes Depardieu over alleged gang rape claims (AFP)" },
  { n: 25, line: "US airlines warned of Al-Qaeda threat before Thanksgiving (AP)" },
  { n: 26, line: "Air India extends Jeddah flight suspension to 24 Nov (Reuters)" },
  { n: 27, line: "Prince William unveils insurance for 10,000 forest staff (PA)" },
  { n: 28, line: "ICMR India completes 100 tech transfers, 20 licences (PTI)" },
  { n: 29, line: "India marks 9th Naturopathy Day, Prakritik Chikitsa (PTI)" },
  { n: 30, line: "Cricket: India face New Zealand in windy Wellington (Reuters)" },
  { n: 31, line: "Football: Liverpool v Man Utd tops Sunday fixtures (PA)" },
  { n: 32, line: "Cricket: Sri Lanka A beat Hong Kong by 24 runs (AP)" },
  { n: 33, line: "Gaza ceasefire under heavy strain as disputes persist (Reuters)" },
  { n: 34, line: "US military wraps collaborative talks in Shanghai (AP)" },
  { n: 35, line: "Sweden summons Russian envoy amid rising tensions (Reuters)" },
];
const SMALL_ICONS = [iconEstonia, iconMexico, iconLebanon, iconGaza, iconCop, iconBrazil, iconIndia, iconJapanIndia, iconMarkets, iconSport];

// ---- the front page ----
function renderPage(): void {
  fillRect(0, 0, PAGE_W, PAGE_H, CREAM);
  const MX = 20, CW = 984;

  // kicker bar
  drawString(MX, 12, "THE WORLD IN ONE DAY", 1, MAROON, true);
  const kr = "35 STORIES · EVERY ONE DATED SUNDAY 22 NOVEMBER 2026";
  drawString(MX + CW - measure(kr, 1), 12, kr, 1, INK, true);
  drawHLine(MX, MX + CW - 1, 32, INK, 2);

  // masthead
  drawString(Math.round((PAGE_W - measure("Sunday 22 November 2026", 5)) / 2), 40, "Sunday 22 November 2026", 5, INK, true);
  drawHLine(MX, MX + CW - 1, 82, INK, 1);

  // sub-headline: the three leads in two centred lines
  drawCentred(88, "Gulf on edge · Trump-Xi-Putin summit in Shenzhen", 2, NAVY, true);
  drawCentred(104, "EU arms Ukraine €1bn · Chapo Isidro captured", 2, NAVY, true);
  drawHLine(MX, MX + CW - 1, 122, INK, 1);

  // stat strip: six numbers
  const stats: [string, string][] = [
    ["€1bn", "EU ARMS FOR UKRAINE"],
    ["11", "KILLED, SINALOA CLASH"],
    ["4 + 35", "KILLED + HURT, BASRA"],
    ["-3%", "CRUDE OIL PRICE"],
    ["10,000", "FOREST STAFF INSURED"],
    ["$75,000", "S. KOREA EXAM BOUNTY"],
  ];
  for (let i = 0; i < 6; i++) {
    const bx = MX + i * 164;
    fillRect(bx, 128, 160, 34, PAPER);
    drawBox(bx, 128, 160, 34, MUTE, 1);
    const [num, lab] = stats[i];
    drawString(bx + Math.round((160 - measure(num, 2)) / 2), 131, num, 2, MAROON, true);
    drawString(bx + Math.round((160 - measure(lab, 1)) / 2), 149, lab, 1, INK, false);
  }

  // region bar, proportional to the real counts
  const regions: [string, number, Colour][] = [
    ["EUROPE", 4, NAVY], ["MIDDLE EAST", 6, EMBER], ["ASIA", 7, MAROON],
    ["AMERICAS", 4, STEEL], ["GLOBAL", 14, MUTE],
  ];
  let rx = MX;
  for (const [, n, c] of regions) {
    const rw = Math.round((n / 35) * CW);
    fillRect(rx, 168, rw, 14, c);
    drawString(rx + Math.round((rw - measure(String(n), 1)) / 2), 170, String(n), 1, SNOW, true);
    rx += rw;
  }
  drawCentred(186, "EUROPE 4 · MIDDLE EAST 6 · ASIA 7 · AMERICAS 4 · GLOBAL 14", 1, INK, true);

  // three lead stories
  const leadArt = [artGulf, artSummit, artEuArms];
  for (let i = 0; i < 3; i++) {
    const lx = MX + i * 328;
    const s = LEADS[i];
    leadArt[i](lx, 204, 320, 104);
    drawBox(lx, 204, 320, 104, MUTE, 1);
    fillRect(lx, 312, 320, 16, MAROON);
    drawString(lx + 6, 316, s.tag, 1, SNOW, true);
    drawBadge(lx + 306, 320, s.n, 9);
    let y = drawBlock(lx, 334, s.head, 320, 2, INK, 16, true);
    y = drawBlock(lx, y + 4, s.body, 320, 1, INK, 9, false);
    drawString(lx, 402, "Source: " + s.src, 1, MUTE, false);
  }

  // ten small stories, five columns by two rows
  for (let i = 0; i < 10; i++) {
    const s = SMALLS[i];
    const col = i % 5, row = Math.floor(i / 5);
    const sx = MX + col * 198, sy = 418 + row * 116;
    SMALL_ICONS[i](sx, sy);
    drawBox(sx, sy, 192, 44, MUTE, 1);
    drawString(sx, sy + 48, s.tag, 1, MAROON, true);
    drawBadge(sx + 184, sy + 52, s.n, 8);
    let y = drawBlock(sx, sy + 60, s.head, 192, 1, INK, 9, true);
    y = drawBlock(sx, y + 1, s.body, 192, 1, INK, 9, false);
    drawString(sx, sy + 106, "Source: " + s.src, 1, MUTE, false);
  }

  drawHLine(MX, MX + CW - 1, 654, INK, 2);

  // map (left) and the ALSO ON list (right)
  drawString(MX, 662, "WHERE IT HAPPENED", 2, INK, true);
  drawString(MX, 678, "Pins match the story numbers", 1, MUTE, false);
  drawWorldMap(MX, 692, 470, 178);
  drawString(MX + 504, 662, "ALSO ON SUNDAY 22 NOVEMBER — 22 MORE STORIES", 1, MAROON, true);
  drawHLine(MX + 504, MX + CW - 1, 678, MAROON, 1);
  for (let i = 0; i < ALSO.length; i++) {
    const a = ALSO[i];
    drawString(MX + 504, 684 + i * 9, a.n + ". " + a.line, 1, INK, false);
  }

  // DATE CHECK: what was deliberately left out
  drawBox(MX, 892, CW, 72, MAROON, 3);
  drawString(MX + 8, 898, "DATE CHECK — WHAT WE LEFT OUT ON PURPOSE", 1, MAROON, true);
  drawBlock(MX + 8, 912, "NOT in this paper: 110 Russian missiles + 400 drones on Ukraine (20 Nov) · missile in Poland (21 Nov) · Kryvyi Rih double-tap, boy 7 killed (21 Nov) · Peru quake 6.9 (20 Nov) · Iran drone strikes on US bases (18-19 Nov) · tanker shot off Oman (18-19 Nov) · Ukraine drone hit on Ust-Luga (21 Nov) · F1 Las Vegas practice (20-21 Nov).", 968, 1, INK, 9, false);
  drawString(MX + 8, 948, "Every story above happened, or was first reported, on Sunday 22 November 2026.", 1, INK, true);

  // footer
  drawCentred(976, "Sources named beside each story · Original drawings, no photos", 1, MUTE, false);
  drawCentred(988, "THE WORLD IN ONE DAY · SUNDAY 22 NOVEMBER 2026", 1, MUTE, true);
}

// ---- minimal PNG writer: filter 0 rows, zlib deflate, CRC32 chunks ----
const CRC: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function buildPNG(): Buffer {
  const raw = Buffer.alloc(PAGE_H * (1 + PAGE_W * 3));
  for (let y = 0; y < PAGE_H; y++) {
    raw[y * (1 + PAGE_W * 3)] = 0;
    canvas.copy(raw, y * (1 + PAGE_W * 3) + 1, y * PAGE_W * 3, (y + 1) * PAGE_W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PAGE_W, 0); ihdr.writeUInt32BE(PAGE_H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function main(): void {
  renderPage();
  const png = buildPNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outDir + "/entry.png", png);
  console.log("wrote " + outDir + "/entry.png " + png.length + " bytes");
}

main();

