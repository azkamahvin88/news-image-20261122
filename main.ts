// Sunday 22 November 2026, drawn as one newspaper page.
// A single-file renderer: it paints 35 dated stories onto a
// 1024 by 1024 canvas and saves a PNG. No network, no assets,
// no randomness — the same bytes come out on every single run.
// Everything on the page comes from the 22 November dossier:
// 3 lead stories, 10 small stories, 22 more in the list, plus
// a red-framed box naming the big stories that are NOT from
// this date and were left out on purpose.

import * as fs from "node:fs";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

const IMG_W = 1024;
const IMG_H = 1024;
const MARGIN = 16;
const PAGE_W = IMG_W - MARGIN * 2;

type Colour = [r: number, g: number, b: number];

const PAPER_BG: Colour = [250, 245, 232];
const SHEET: Colour = [253, 250, 238];
const INK_DARK: Colour = [26, 26, 28];
const CRIMSON: Colour = [164, 32, 28];
const CRIMSON_DEEP: Colour = [126, 22, 22];
const NAVY_BLUE: Colour = [30, 48, 88];
const STEEL_BLUE: Colour = [62, 114, 168];
const PALE_SKY: Colour = [210, 229, 240];
const LEAF: Colour = [92, 144, 92];
const MEADOW: Colour = [182, 208, 160];
const AMBER: Colour = [205, 152, 46];
const TANGERINE: Colour = [228, 114, 34];
const STONE: Colour = [124, 122, 114];
const SAND: Colour = [232, 222, 196];
const CHARCOAL: Colour = [40, 40, 42];
const SNOW: Colour = [255, 255, 255];

// ------------------------------------------------------------------
// Letterforms. Every glyph is eight rows tall and five pixels wide,
// stored as one hex byte per row: the top bit is the leftmost pixel.
// The shapes below were drawn by hand for this page — capitals fill
// all seven upper rows, small letters sit on rows two to six, and
// the tails of g, j, p, q and y drop into the eighth row.
// ------------------------------------------------------------------
const CELL_W = 6;
const CELL_H = 8;

const GLYPH: Record<string, readonly number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11, 0x00],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e, 0x00],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e, 0x00],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e, 0x00],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f, 0x00],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10, 0x00],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f, 0x00],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11, 0x00],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e, 0x00],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c, 0x00],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11, 0x00],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f, 0x00],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11, 0x00],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11, 0x00],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e, 0x00],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10, 0x00],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d, 0x00],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11, 0x00],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e, 0x00],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x00],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e, 0x00],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04, 0x00],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11, 0x00],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11, 0x00],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04, 0x00],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f, 0x00],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f, 0x00],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e, 0x00],
  c: [0x00, 0x00, 0x0e, 0x10, 0x10, 0x11, 0x0e, 0x00],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f, 0x00],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e, 0x00],
  f: [0x06, 0x08, 0x08, 0x1e, 0x08, 0x08, 0x08, 0x00],
  g: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11, 0x00],
  i: [0x00, 0x04, 0x00, 0x0c, 0x04, 0x04, 0x0e, 0x00],
  j: [0x00, 0x02, 0x00, 0x06, 0x02, 0x02, 0x02, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12, 0x00],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e, 0x00],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15, 0x00],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11, 0x00],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e, 0x00],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10, 0x00],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e, 0x00],
  t: [0x04, 0x04, 0x1f, 0x04, 0x04, 0x04, 0x03, 0x00],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0f, 0x00],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04, 0x00],
  w: [0x00, 0x00, 0x11, 0x15, 0x15, 0x15, 0x0a, 0x00],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x00],
  y: [0x00, 0x00, 0x11, 0x11, 0x0b, 0x07, 0x02, 0x0c],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f, 0x00],
};

// Numerals and punctuation, same hand-drawn 5 by 8 grid.
const GLYPH_NUM: Record<string, readonly number[]> = {
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e, 0x00],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e, 0x00],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f, 0x00],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e, 0x00],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02, 0x00],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e, 0x00],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e, 0x00],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08, 0x00],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e, 0x00],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c, 0x00],
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x00],
  ",": [0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x04, 0x08],
  ":": [0x00, 0x00, 0x0c, 0x00, 0x00, 0x0c, 0x00, 0x00],
  ";": [0x00, 0x00, 0x0c, 0x00, 0x00, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04, 0x00],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04, 0x00],
  "-": [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00, 0x00],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02, 0x00],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08, 0x00],
  "/": [0x01, 0x02, 0x04, 0x04, 0x08, 0x08, 0x10, 0x00],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13, 0x00],
  "€": [0x06, 0x09, 0x10, 0x1e, 0x10, 0x09, 0x06, 0x00],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04, 0x00],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d, 0x00],
  "+": [0x00, 0x00, 0x04, 0x0e, 0x04, 0x00, 0x00, 0x00],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "*": [0x00, 0x04, 0x15, 0x0e, 0x15, 0x00, 0x00, 0x00],
  _: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
  "•": [0x00, 0x00, 0x00, 0x0e, 0x0e, 0x00, 0x00, 0x00],
  "·": [0x00, 0x00, 0x00, 0x0e, 0x0e, 0x00, 0x00, 0x00],
  "–": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x00],
  "—": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x00],
  "×": [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x00],
  "#": [0x00, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x00, 0x00],
  "@": [0x0e, 0x11, 0x17, 0x15, 0x16, 0x10, 0x0e, 0x00],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e, 0x00],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e, 0x00],
  "<": [0x00, 0x02, 0x04, 0x08, 0x04, 0x02, 0x00, 0x00],
  ">": [0x00, 0x08, 0x04, 0x02, 0x04, 0x08, 0x00, 0x00],
};

function glyphRows(ch: string): readonly number[] {
  return GLYPH[ch] ?? GLYPH_NUM[ch] ?? GLYPH_NUM[" "];
}

// ------------------------------------------------------------------
// Canvas: one RGB buffer, plus the small drawing vocabulary the page
// is built from — dots, bars, frames, lines, discs and triangles.
// ------------------------------------------------------------------
const px = new Uint8Array(IMG_W * IMG_H * 3);
for (let i = 0; i < IMG_W * IMG_H; i++) {
  px[i * 3] = PAPER_BG[0];
  px[i * 3 + 1] = PAPER_BG[1];
  px[i * 3 + 2] = PAPER_BG[2];
}

function dab(x: number, y: number, c: Colour): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= IMG_W || yi >= IMG_H) return;
  const o = (yi * IMG_W + xi) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function paintBox(x: number, y: number, w: number, h: number, c: Colour): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(IMG_W, x + w);
  const y1 = Math.min(IMG_H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) dab(xx, yy, c);
  }
}

function frameBox(x: number, y: number, w: number, h: number, c: Colour, t = 1): void {
  paintBox(x, y, w, t, c);
  paintBox(x, y + h - t, w, t, c);
  paintBox(x, y, t, h, c);
  paintBox(x + w - t, y, t, h, c);
}

function seg(x0: number, y0: number, x1: number, y1: number, c: Colour): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    dab(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: Colour): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) dab(cx + x, cy + y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, c: Colour): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    dab(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Colour): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) dab(x, y, c);
    }
  }
}

// ------------------------------------------------------------------
// Text: draw one glyph, one line, or a wrapped paragraph.
// ------------------------------------------------------------------
function putGlyph(ch: string, x: number, y: number, scale: number, c: Colour): void {
  const rows = glyphRows(ch);
  for (let r = 0; r < CELL_H; r++) {
    const bits = rows[r];
    if (bits === 0) continue;
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) {
        paintBox(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function textWidth(s: string, scale: number): number {
  return s.length * CELL_W * scale;
}

function ink(s: string, x: number, y: number, scale: number, c: Colour): number {
  let cx = x;
  for (const ch of s) {
    putGlyph(ch, cx, y, scale, c);
    cx += CELL_W * scale;
  }
  return cx - x;
}

function inkCentred(s: string, cx: number, y: number, scale: number, c: Colour): void {
  ink(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, c);
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cand.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cand;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function inkWrapped(text: string, x: number, y: number, maxW: number, scale: number, lh: number, c: Colour): number {
  const maxChars = Math.max(1, Math.floor(maxW / (CELL_W * scale)));
  const lines = wrapLines(text, maxChars);
  for (let i = 0; i < lines.length; i++) ink(lines[i], x, y + i * lh, scale, c);
  return lines.length;
}

// ------------------------------------------------------------------
// The stories. Every fact below is taken from the 22 November
// dossier; the wording is trimmed to fit the page, nothing is
// invented, and each item carries the outlet that reported it.
// ------------------------------------------------------------------
type Story = { num: number; tag: string; head: string; body: string; src: string };

const LEADS: Story[] = [
  {
    num: 1,
    tag: "MIDDLE EAST · BAHRAIN",
    head: "GULF ON EDGE",
    body: "Bahrain is probing a fallen Patriot interceptor as fresh reports tell of Iranian drone attacks. Tehran calls the Qeshm blast a US ammunition disposal, not a new strike. Washington reissues a security alert for Bahrain and Saudi Arabia.",
    src: "Times of India",
  },
  {
    num: 2,
    tag: "GLOBAL · SHENZHEN",
    head: "TRUMP–XI–PUTIN SUMMIT",
    body: "Trump lands in Shenzhen for APEC, with a trilateral meeting with Xi and Putin on the schedule. After meeting Xi he calls China's nuclear build-up 'rapid and concerning'. He says an Iran deal could last 20 years and eyes 'ultimate regime change'.",
    src: "Times of India / pw.live",
  },
  {
    num: 3,
    tag: "EUROPE · EUR 1bn",
    head: "EU ARMS UKRAINE",
    body: "The European Union sends EUR 1bn more in military aid to Ukraine. Denmark expels a Russian diplomat over an alleged plot to kill a Ukrainian rapper, and says Moscow is behind a plot to kill a US-Ukrainian citizen.",
    src: "EU / Denmark",
  },
];

const SMALLS: Story[] = [
  {
    num: 4,
    tag: "EUROPE",
    head: "ESTONIA SHUTS BORDER",
    body: "Estonia closes its border with Russia. Moscow denounces a 'new Iron Curtain'. (Times of India)",
    src: "Times of India",
  },
  {
    num: 5,
    tag: "AMERICAS",
    head: "'EL CHAPO ISIDRO' SEIZED",
    body: "FBI top-10 fugitive seized in Sinaloa. 4 soldiers, 7 gunmen killed, 8 arrested; cartel violence leaves 11 dead. (Reuters)",
    src: "Reuters",
  },
  {
    num: 6,
    tag: "MIDDLE EAST",
    head: "UNIFIL HANDS OVER SOUTH",
    body: "UNIFIL begins handing control of southern Lebanon to the Lebanese army. (Times of India)",
    src: "Times of India",
  },
  {
    num: 7,
    tag: "MIDDLE EAST",
    head: "GAZA CEASEFIRE BREACH",
    body: "4 Palestinians killed, 14 wounded in Israeli ceasefire violations in Gaza. (Al Jazeera)",
    src: "Al Jazeera",
  },
  {
    num: 8,
    tag: "GLOBAL",
    head: "COP31 NEARS FINAL DEAL",
    body: "Climate summit nears a final deal, says the chief. Its AI pledge fails to draw big US tech firms. (Times of India)",
    src: "Times of India",
  },
  {
    num: 9,
    tag: "AMERICAS",
    head: "BOLSONARO IN ICU",
    body: "Jailed ex-president Jair Bolsonaro is in intensive care with acute intestinal obstruction. (AP)",
    src: "AP",
  },
  {
    num: 10,
    tag: "ASIA",
    head: "MODI OPENS NITISH SETU",
    body: "PM Modi opens the Nitish Setu bridge, Patna-Vaishali, Bihar. Cyclone Akvan: 14 flights axed at Ranchi. (Times of India)",
    src: "Times of India",
  },
  {
    num: 11,
    tag: "ASIA",
    head: "JAPAN TO DRILL IN INDIA",
    body: "For the first time, Japanese troops will use Indian facilities for live-fire drills. (Times of India)",
    src: "Times of India",
  },
  {
    num: 12,
    tag: "GLOBAL",
    head: "OIL SLIDES OVER 3%",
    body: "Crude slides over 3% to Rs 7,842 a barrel. Sensex ends a two-day rally on Fed rate worries. (Times of India)",
    src: "Times of India",
  },
  {
    num: 13,
    tag: "GLOBAL",
    head: "CUMMINS KEEPS CAPTAINCY",
    body: "Pat Cummins wins unanimous Cricket Australia backing to stay Test captain. (Times of India)",
    src: "Times of India",
  },
];

const ALSO: { num: number; text: string; src: string }[] = [
  { num: 14, text: "US-Canada: Hegseth sets new limits on US-Canada defence ties.", src: "Reuters" },
  { num: 15, text: "US-Iran: US reports economic pressure on Iran rising; trilateral consensus on nukes.", src: "AP" },
  { num: 16, text: "France seeks UN Security Council action after Myanmar rejects ICJ ruling.", src: "AFP" },
  { num: 17, text: "Saudi-led coalition shoots down 3 Houthi missiles headed for Riyadh.", src: "Al Jazeera" },
  { num: 18, text: "Zelensky: new peace talks could be held at the G-20 summit.", src: "Reuters" },
  { num: 19, text: "N. Gupta sentenced to 19 years in US over Pannun murder plot.", src: "AP" },
  { num: 20, text: "EU chief proposes 2028-2034 budget cuts, digital platform tax.", src: "Reuters" },
  { num: 21, text: "Iraq: fire at Basra power facility - 4 killed, 35 wounded.", src: "AP" },
  { num: 22, text: "South Korea offers $75,000 bounty for exam-cheating reports.", src: "Korea JoongAng Daily" },
  { num: 23, text: "Israel: Eisenkot invites Netanyahu's Likud to coalition talks.", src: "Times of India" },
  { num: 24, text: "France probes Depardieu and a writer over gang-rape claims.", src: "AFP" },
  { num: 25, text: "US airlines warned of possible Al-Qaeda-linked terror threat before Thanksgiving.", src: "AP" },
  { num: 26, text: "Air India extends Jeddah flight suspension to 24 Nov.", src: "Times of India" },
  { num: 27, text: "Prince William announces insurance scheme for 10,000 forestry staff.", src: "BBC" },
  { num: 28, text: "India's ICMR completes 100 tech transfers, signs 20 licensing deals.", src: "Times of India" },
  { num: 29, text: "India marks 9th Naturopathy Day, theme 'Prakritik Chikitsa, Swasth Bharat'.", src: "Times of India" },
  { num: 30, text: "Cricket: India face New Zealand in windy Wellington.", src: "Times of India" },
  { num: 31, text: "Football: Liverpool v Man Utd headline Sunday (PL 11, 16:30 GMT); Barca, Juve, Milan, Inter play.", src: "BBC" },
  { num: 32, text: "Cricket: Sri Lanka A beat Hong Kong by 24 runs (284/9 vs 260/9), Asia Cup Rising Stars.", src: "Times of India" },
  { num: 33, text: "Middle East: Gaza ceasefire under severe strain; implementation disputes continue.", src: "Al Jazeera" },
  { num: 34, text: "China-US: US military wraps up collaborative talks in Shanghai.", src: "Reuters" },
  { num: 35, text: "Sweden summons Russian ambassador amid rising tensions.", src: "AFP" },
];

const DATE_CHECK: string[] = [
  "110 missiles + 400 drones hit Ukraine — 20 Nov, NOT 22 Nov.",
  "Russian missile lands in Poland — 21 Nov, NOT 22 Nov.",
  "Double-tap strike on Kryvyi Rih, boy 7 killed — 21 Nov, NOT 22 Nov.",
  "Peru quake 6.9, Junin — 20 Nov local (21 Nov 00:09 UTC), NOT 22 Nov.",
  "Iran drone attack on US bases in Kuwait + Bahrain — 18–19 Nov, NOT 22 Nov.",
  "Tanker fired on off Oman / Strait of Hormuz — 18–19 Nov, NOT 22 Nov.",
  "Ukraine drone strike on Ust-Luga oil port — 21 Nov, NOT 22 Nov.",
  "F1 Las Vegas GP qualifying / practice — 20–21 Nov, NOT 22 Nov.",
];

const STATS: { big: string; small: string }[] = [
  { big: "EUR 1bn", small: "EU military aid, Ukraine" },
  { big: "11 killed", small: "Sinaloa cartel violence" },
  { big: "4 dead", small: "35 hurt in Basra fire" },
  { big: "-3%", small: "crude oil slide" },
  { big: "10,000", small: "forestry staff insured" },
  { big: "$75,000", small: "S. Korea exam bounty" },
];

const REGIONS: { name: string; count: number; colour: Colour }[] = [
  { name: "Europe", count: 4, colour: NAVY_BLUE },
  { name: "Middle East", count: 6, colour: CRIMSON },
  { name: "Asia", count: 7, colour: LEAF },
  { name: "Americas", count: 4, colour: AMBER },
  { name: "Global", count: 14, colour: STEEL_BLUE },
];

// ------------------------------------------------------------------
// Flat original drawings, one per featured story. Each one is built
// from the same small vocabulary above — no photos, no copied art.
// ------------------------------------------------------------------
function drawLeadArt(kind: number, x: number, y: number, w: number, h: number): void {
  if (kind === 1) {
    // Gulf at dusk: pale sky, dark sea, an island, a burst over it.
    paintBox(x, y, w, h, PALE_SKY);
    paintBox(x, y + 54, w, h - 54, STEEL_BLUE);
    paintBox(x + 40, y + 44, 150, 12, SAND);
    tri(x + 90, y + 20, x + 130, y + 44, x + 170, y + 44, LEAF);
    disc(x + 210, y + 26, 16, AMBER);
    tri(x + 210, y + 2, x + 218, y + 22, x + 202, y + 22, CRIMSON);
    tri(x + 210, y + 50, x + 218, y + 30, x + 202, y + 30, CRIMSON);
    tri(x + 186, y + 26, x + 206, y + 18, x + 206, y + 34, CRIMSON);
    tri(x + 234, y + 26, x + 214, y + 18, x + 214, y + 34, CRIMSON);
    seg(x + 250, y + 10, x + 292, y + 40, INK_DARK);
    paintBox(x + 288, y + 36, 10, 4, INK_DARK);
    seg(x + 30, y + 66, x + 90, y + 66, SNOW);
    seg(x + 120, y + 70, x + 200, y + 70, SNOW);
    seg(x + 230, y + 66, x + 300, y + 66, SNOW);
  } else if (kind === 2) {
    // Three flags over a summit table.
    paintBox(x, y, w, h, SHEET);
    paintBox(x, y + 68, w, 4, CHARCOAL);
    paintBox(x + 30, y + 72, w - 60, 12, SAND);
    for (let i = 0; i < 3; i++) {
      const px0 = x + 52 + i * 96;
      paintBox(px0, y + 8, 3, 60, CHARCOAL);
    }
    // United States: striped field, blue canton.
    paintBox(x + 55, y + 10, 52, 30, SNOW);
    for (let s = 0; s < 4; s++) paintBox(x + 55, y + 10 + s * 8, 52, 4, CRIMSON);
    paintBox(x + 55, y + 10, 22, 16, NAVY_BLUE);
    // China: crimson field, amber stars.
    paintBox(x + 151, y + 10, 52, 30, CRIMSON);
    disc(x + 164, y + 22, 4, AMBER);
    disc(x + 180, y + 18, 2, AMBER);
    disc(x + 184, y + 26, 2, AMBER);
    disc(x + 176, y + 32, 2, AMBER);
    // Russia: white, blue, crimson bands.
    paintBox(x + 247, y + 10, 52, 30, SNOW);
    paintBox(x + 247, y + 20, 52, 10, STEEL_BLUE);
    paintBox(x + 247, y + 30, 52, 10, CRIMSON);
  } else {
    // EU stars around a shield.
    paintBox(x, y, w, h, NAVY_BLUE);
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180;
      disc(Math.round(x + 160 + 118 * Math.cos(a)), Math.round(y + 42 + 30 * Math.sin(a)), 3, AMBER);
    }
    paintBox(x + 138, y + 22, 44, 34, STEEL_BLUE);
    tri(x + 138, y + 56, x + 182, y + 56, x + 160, y + 78, STEEL_BLUE);
    frameBox(x + 138, y + 22, 44, 34, AMBER, 2);
    seg(x + 146, y + 66, x + 174, y + 30, SNOW);
    seg(x + 174, y + 66, x + 146, y + 30, SNOW);
  }
}

function drawSmallArt(kind: number, x: number, y: number, w: number, h: number): void {
  if (kind === 4) {
    paintBox(x, y, w, h, SAND);
    paintBox(x + 8, y + 6, 26, 8, STEEL_BLUE);
    paintBox(x + 8, y + 14, 26, 8, CHARCOAL);
    paintBox(x + 8, y + 22, 26, 8, SNOW);
    for (let i = 0; i < 7; i++) paintBox(x + 60 + i * 18, y + 2, 3, h - 4, STONE);
    paintBox(x + 56, y + 8, w - 60, 3, STONE);
    paintBox(x + 56, y + 24, w - 60, 3, STONE);
  } else if (kind === 5) {
    paintBox(x, y, w, h, PALE_SKY);
    tri(x + 10, y + h, x + 55, y + 6, x + 100, y + h, LEAF);
    tri(x + 80, y + h, x + 130, y + 12, x + 180, y + h, STONE);
    disc(x + 160, y + 8, 6, AMBER);
    ring(x + 30, y + 24, 8, AMBER);
    disc(x + 30, y + 24, 3, AMBER);
  } else if (kind === 6) {
    paintBox(x, y, w, h, SHEET);
    tri(x + 88, y + 2, x + 108, y + 2, x + 98, y + 16, LEAF);
    tri(x + 84, y + 12, x + 112, y + 12, x + 98, y + 26, LEAF);
    paintBox(x + 96, y + 26, 4, 6, CHARCOAL);
    seg(x + 20, y + 28, x + 170, y + 28, LEAF);
    paintBox(x + 20, y + 28, 150, 2, LEAF);
  } else if (kind === 7) {
    paintBox(x, y, w, h, SAND);
    paintBox(x + 14, y + 12, 26, 20, STONE);
    paintBox(x + 48, y + 6, 30, 26, CHARCOAL);
    paintBox(x + 86, y + 14, 24, 18, STONE);
    paintBox(x + 118, y + 10, 30, 22, CHARCOAL);
    disc(x + 168, y + 8, 6, TANGERINE);
    paintBox(x + 52, y + 12, 4, 4, SNOW);
    paintBox(x + 62, y + 20, 4, 4, SNOW);
    paintBox(x + 124, y + 16, 4, 4, SNOW);
  } else if (kind === 8) {
    paintBox(x, y, w, h, PALE_SKY);
    disc(x + 40, y + 17, 14, STEEL_BLUE);
    paintBox(x + 32, y + 10, 10, 6, LEAF);
    paintBox(x + 42, y + 20, 12, 6, LEAF);
    tri(x + 90, y + 26, x + 104, y + 10, x + 118, y + 26, LEAF);
    seg(x + 104, y + 26, x + 104, y + 32, LEAF);
    seg(x + 130, y + 8, x + 170, y + 8, CRIMSON);
    seg(x + 130, y + 16, x + 160, y + 16, CRIMSON);
    seg(x + 130, y + 24, x + 150, y + 24, CRIMSON);
  } else if (kind === 9) {
    paintBox(x, y, w, h, LEAF);
    tri(x + 30, y + 17, x + 60, y + 2, x + 90, y + 17, AMBER);
    tri(x + 30, y + 17, x + 60, y + 32, x + 90, y + 17, AMBER);
    disc(x + 60, y + 17, 9, STEEL_BLUE);
    paintBox(x + 130, y + 6, 34, 22, SNOW);
    paintBox(x + 144, y + 8, 6, 18, CRIMSON);
    paintBox(x + 136, y + 14, 22, 6, CRIMSON);
  } else if (kind === 10) {
    paintBox(x, y, w, h, PALE_SKY);
    paintBox(x, y + 26, w, 8, STEEL_BLUE);
    seg(x + 10, y + 24, x + 90, y + 8, CHARCOAL);
    seg(x + 90, y + 8, x + 180, y + 24, CHARCOAL);
    paintBox(x + 24, y + 12, 4, 16, CHARCOAL);
    paintBox(x + 88, y + 6, 4, 22, CHARCOAL);
    paintBox(x + 156, y + 12, 4, 16, CHARCOAL);
    paintBox(x + 10, y + 22, 170, 3, INK_DARK);
  } else if (kind === 11) {
    paintBox(x, y, w, h, SHEET);
    paintBox(x + 16, y + 6, 66, 22, SNOW);
    frameBox(x + 16, y + 6, 66, 22, STONE, 1);
    disc(x + 49, y + 17, 7, CRIMSON);
    paintBox(x + 108, y + 6, 66, 22, SNOW);
    paintBox(x + 108, y + 6, 66, 7, TANGERINE);
    paintBox(x + 108, y + 21, 66, 7, LEAF);
    ring(x + 141, y + 17, 4, NAVY_BLUE);
  } else if (kind === 12) {
    paintBox(x, y, w, h, SHEET);
    seg(x + 14, y + 28, x + 180, y + 28, INK_DARK);
    seg(x + 14, y + 4, x + 14, y + 28, INK_DARK);
    paintBox(x + 30, y + 14, 16, 14, STEEL_BLUE);
    paintBox(x + 60, y + 18, 16, 10, STEEL_BLUE);
    paintBox(x + 90, y + 22, 16, 6, CRIMSON);
    paintBox(x + 120, y + 24, 16, 4, CRIMSON);
    seg(x + 24, y + 8, x + 170, y + 26, CRIMSON);
  } else {
    paintBox(x, y, w, h, MEADOW);
    paintBox(x + 30, y + 8, 60, 4, SAND);
    paintBox(x + 36, y + 12, 3, 14, AMBER);
    paintBox(x + 44, y + 12, 3, 14, AMBER);
    paintBox(x + 52, y + 12, 3, 14, AMBER);
    paintBox(x + 100, y + 6, 8, 20, STONE);
    paintBox(x + 112, y + 4, 8, 22, STONE);
    disc(x + 160, y + 22, 7, CRIMSON);
    seg(x + 160, y + 15, x + 160, y + 29, SNOW);
  }
}

function drawBadge(num: number, cx: number, cy: number, r: number): void {
  disc(cx, cy, r, CRIMSON);
  ring(cx, cy, r, SNOW);
  const label = String(num);
  inkCentred(label, cx, cy - 4, 1, SNOW);
}

// ------------------------------------------------------------------
// Page layout, top to bottom: kicker, masthead, sub-headline, stat
// strip, region bar, three leads, ten small stories, the map next
// to the numbered list, the red DATE CHECK box, and the footer.
// ------------------------------------------------------------------
function compose(): void {
  // Kicker bar.
  paintBox(MARGIN, 10, PAGE_W, 20, INK_DARK);
  ink("THE WORLD IN ONE DAY", MARGIN + 8, 16, 1, SNOW);
  const kickRight = "35 STORIES · EVERY ONE DATED SUNDAY 22 NOVEMBER 2026";
  ink(kickRight, IMG_W - MARGIN - 8 - textWidth(kickRight, 1), 16, 1, SNOW);

  // Masthead.
  inkCentred("Sunday 22 November 2026", IMG_W / 2, 38, 6, INK_DARK);
  paintBox(MARGIN, 92, PAGE_W, 2, INK_DARK);
  inkCentred(
    "Gulf on edge · Trump–Xi–Putin meet in Shenzhen · EU sends Ukraine EUR 1bn more",
    IMG_W / 2,
    98,
    2,
    INK_DARK,
  );

  // Stat strip: six numbers with labels.
  paintBox(MARGIN, 120, PAGE_W, 40, SHEET);
  frameBox(MARGIN, 120, PAGE_W, 40, INK_DARK, 1);
  const cellXs = [16, 181, 346, 512, 677, 842];
  const cellWs = [165, 165, 166, 165, 165, 166];
  for (let i = 1; i < 6; i++) {
    paintBox(cellXs[i], 124, 1, 32, STONE);
  }
  for (let i = 0; i < STATS.length; i++) {
    const cx = cellXs[i] + cellWs[i] / 2;
    inkCentred(STATS[i].big, cx, 126, 2, CRIMSON_DEEP);
    inkCentred(STATS[i].small, cx, 146, 1, INK_DARK);
  }

  // Region bar: coloured segments sized by story count.
  let rx = MARGIN;
  const total = REGIONS.reduce((a, r) => a + r.count, 0);
  for (let ri = 0; ri < REGIONS.length; ri++) {
    const r = REGIONS[ri];
    const w = ri === REGIONS.length - 1 ? MARGIN + PAGE_W - rx : Math.round((r.count / total) * PAGE_W);
    paintBox(rx, 166, w, 20, r.colour);
    inkCentred(`${r.name} ${r.count}`, rx + w / 2, 172, 1, SNOW);
    rx += w;
  }

  // Three lead stories.
  const leadXs = [16, 352, 688];
  for (let i = 0; i < LEADS.length; i++) {
    const s = LEADS[i];
    const x = leadXs[i];
    const y0 = 194;
    drawLeadArt(s.num, x, y0, 320, 84);
    frameBox(x, y0, 320, 84, INK_DARK, 1);
    const tagW = textWidth(s.tag, 1);
    paintBox(x, y0, tagW + 10, 14, CRIMSON);
    ink(s.tag, x + 5, y0 + 3, 1, SNOW);
    drawBadge(s.num, x + 306, y0 + 14, 11);
    ink(s.head, x, y0 + 90, 2, INK_DARK);
    inkWrapped(s.body, x, y0 + 110, 320, 1, 10, INK_DARK);
    ink("(" + s.src + ")", x, y0 + 174, 1, STONE);
  }

  paintBox(MARGIN, 381, PAGE_W, 1, STONE);

  // Ten small stories, two rows of five.
  const smallXs = [16, 216, 416, 616, 816];
  const smallYs = [384, 476];
  for (let i = 0; i < SMALLS.length; i++) {
    const s = SMALLS[i];
    const x = smallXs[i % 5];
    const y0 = smallYs[Math.floor(i / 5)];
    drawSmallArt(s.num, x, y0, 190, 34);
    frameBox(x, y0, 190, 34, INK_DARK, 1);
    const tagW = textWidth(s.tag, 1);
    paintBox(x, y0 + 24, tagW + 6, 10, CRIMSON);
    ink(s.tag, x + 3, y0 + 25, 1, SNOW);
    drawBadge(s.num, x + 179, y0 + 11, 8);
    ink(s.head, x, y0 + 38, 1, INK_DARK);
    inkWrapped(s.body, x, y0 + 50, 190, 1, 9, INK_DARK);
  }

  // Bottom left: the map.
  ink("WHERE IT HAPPENED", MARGIN, 576, 2, INK_DARK);
  const bx = 16;
  const by = 596;
  paintBox(bx, by, 320, 232, PALE_SKY);
  paintBox(bx + 28, by + 22, 66, 38, MEADOW);
  paintBox(bx + 18, by + 52, 56, 22, MEADOW);
  paintBox(bx + 86, by + 58, 28, 18, MEADOW);
  paintBox(bx + 102, by + 8, 18, 14, MEADOW);
  paintBox(bx + 72, by + 102, 34, 58, MEADOW);
  tri(bx + 72, by + 160, bx + 106, by + 160, bx + 89, by + 186, MEADOW);
  paintBox(bx + 158, by + 20, 44, 32, MEADOW);
  paintBox(bx + 148, by + 48, 30, 16, MEADOW);
  paintBox(bx + 152, by + 68, 54, 66, MEADOW);
  tri(bx + 152, by + 134, bx + 206, by + 134, bx + 179, by + 162, MEADOW);
  paintBox(bx + 206, by + 18, 96, 52, MEADOW);
  paintBox(bx + 206, by + 66, 78, 34, MEADOW);
  tri(bx + 240, by + 100, bx + 262, by + 100, bx + 251, by + 122, MEADOW);
  disc(bx + 286, by + 96, 4, MEADOW);
  disc(bx + 296, by + 106, 3, MEADOW);
  paintBox(bx + 252, by + 148, 54, 26, MEADOW);
  paintBox(bx + 298, by + 42, 8, 18, MEADOW);
  paintBox(bx + 150, by + 30, 8, 12, MEADOW);
  frameBox(bx, by, 320, 232, INK_DARK, 1);
  const pins: [number, number, number][] = [
    [1, 246, 676],
    [2, 301, 658],
    [3, 210, 630],
    [4, 196, 618],
    [5, 68, 668],
    [6, 222, 646],
    [7, 214, 668],
    [8, 146, 716],
    [9, 100, 726],
    [10, 264, 684],
    [11, 316, 644],
    [12, 286, 691],
    [13, 294, 756],
  ];
  for (const [n, px0, py0] of pins) drawBadge(n, px0, py0, 8);
  ink("Pins match the 13 featured stories.", MARGIN, 836, 1, STONE);

  // Bottom right: the numbered list of 22 more stories.
  paintBox(340, 576, 1, 280, STONE);
  ink("ALSO ON SUNDAY 22 NOVEMBER — 22 MORE STORIES", 344, 576, 2, INK_DARK);
  for (let i = 0; i < ALSO.length; i++) {
    const a = ALSO[i];
    ink(`${a.num}. ${a.text} (${a.src})`, 344, 596 + i * 12, 1, INK_DARK);
  }

  // DATE CHECK: what was deliberately left out.
  paintBox(18, 888, 988, 98, SHEET);
  frameBox(MARGIN, 886, PAGE_W, 102, CRIMSON, 2);
  ink("DATE CHECK — DELIBERATELY LEFT OUT", 28, 894, 2, CRIMSON);
  for (let i = 0; i < DATE_CHECK.length; i++) {
    const col = i < 4 ? 28 : 520;
    const row = i % 4;
    ink("• " + DATE_CHECK[i], col, 916 + row * 18, 1, INK_DARK);
  }

  // Footer.
  inkCentred(
    "Every story here happened, or was first reported, on Sunday 22 November 2026 · Sources named beside each story · Original drawings",
    IMG_W / 2,
    996,
    1,
    INK_DARK,
  );
}

// ------------------------------------------------------------------
// PNG writer: filter byte zero per scanline, zlib level 9, CRC32
// computed by hand. Deterministic — same input, same bytes.
// ------------------------------------------------------------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(tag: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(tag, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(tag, "ascii"), data]));
  out.writeUInt32BE(crc >>> 0, 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const stride = 1 + IMG_W * 3;
  const raw = Buffer.alloc(IMG_H * stride);
  for (let y = 0; y < IMG_H; y++) {
    raw[y * stride] = 0;
    raw.set(px.subarray(y * IMG_W * 3, (y + 1) * IMG_W * 3), y * stride + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(IMG_W, 0);
  ihdr.writeUInt32BE(IMG_H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

compose();
const out = encodePng();
fs.mkdirSync("/output", { recursive: true });
fs.writeFileSync("/output/entry.png", out);
const sum = crypto.createHash("md5").update(out).digest("hex");
console.log(`entry.png ${out.length} bytes md5 ${sum}`);
