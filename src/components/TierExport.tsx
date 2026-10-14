"use client";

import { useEffect, useRef, useState } from "react";
import { lineSpriteUrl } from "@/lib/lines";
import { type RankedLine, type TierId, TIERS } from "@/lib/tiers";

export interface ExportSection {
  /** Island name when exporting By Island; none for a single list. */
  heading?: string;
  tiers: Map<TierId, RankedLine[]>;
}

/** Tier badge colors, same as TierBoard. */
const TIER_COLOR: Record<TierId, { bg: string; fg: string }> = {
  top: { bg: "#ffd24d", fg: "#5b3e00" },
  S: { bg: "#ff8fab", fg: "#ffffff" },
  A: { bg: "#ffb36b", fg: "#ffffff" },
  B: { bg: "#ffd24d", fg: "#5b3e00" },
  C: { bg: "#a8dd7a", fg: "#2f5a12" },
  avoid: { bg: "#8a97ab", fg: "#ffffff" },
};

// Layout in CSS pixels; the PNG is drawn at SCALE x for sharp sprites. 540 x 2
// = 1080 px wide: readable on a phone, and not oversized on a desktop.
const SCALE = 2;
const COLS = 10;
const ICON = 44;
const GAP = 3;
const PAD = 12;
const LABEL_W = 48;
const WIDTH = PAD * 2 + LABEL_W + 8 + COLS * ICON + (COLS - 1) * GAP;
const ROW_PAD = 6;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Gold for Top 3 picks, as on the board's Top 3 row. */
const STAR_GOLD = "#f2a900";

/**
 * Top 3 ring width for a line, by how its stars compare with the most-starred
 * line in the image: thin for a lone fan, thick for the crowd favorites. Relative,
 * so a 5-friend list and a 300-player one both use the full range.
 */
function ringWidth(tops: number, maxTops: number): number {
  if (tops <= 0 || maxTops <= 0) return 0;
  const share = tops / maxTops;
  return share > 2 / 3 ? 4 : share > 1 / 3 ? 2.75 : 1.5;
}

/**
 * Draws the compact tier list: a header, then per section (one list, or one
 * per island) a row per tier of sprites only, best first. No ratings or vote
 * counts, so it stays small enough to share. Lines someone starred as a Top 3
 * get a gold ring (thicker with more stars) and, from 2 stars, a ★ count.
 */
async function renderPng(title: string, voters: number, sections: ExportSection[]): Promise<Blob> {
  await document.fonts.ready;
  const font = getComputedStyle(document.body).fontFamily;

  const rows = sections.map((section) =>
    // The ranked tiers only: the Top 3 row (players' favorites, not a tier) stays on the site.
    TIERS.filter((tier) => tier.id !== "top").flatMap((tier) => {
      const lines = section.tiers.get(tier.id) ?? [];
      return lines.length ? [{ tier, lines }] : [];
    }),
  );
  const maxTops = Math.max(0, ...rows.flat().flatMap((row) => row.lines.map((r) => r.tops)));
  const rowHeight = (n: number) => Math.ceil(n / COLS) * (ICON + GAP) - GAP + ROW_PAD * 2;
  const HEADER = 58;
  const SECTION_HEAD = 30;
  const FOOTER = 26;
  let height = PAD + HEADER;
  sections.forEach((section, i) => {
    if (section.heading) height += SECTION_HEAD;
    for (const row of rows[i]) height += rowHeight(row.lines.length) + 4;
    height += 6;
  });
  height += FOOTER;

  const sprites = new Map<string, HTMLImageElement | null>();
  const urls = new Set(rows.flat().flatMap((row) => row.lines.map((r) => lineSpriteUrl(r.line))));
  await Promise.all([...urls].map(async (url) => sprites.set(url, await loadImage(url))));

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#e4f2ff";
  ctx.fillRect(0, 0, WIDTH, height);

  // Header: title and what the list is.
  ctx.fillStyle = "#2d3354";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 20px ${font}`;
  ctx.fillText("Candy Tier List", PAD, PAD + 22);
  ctx.font = `400 13px ${font}`;
  ctx.fillStyle = "#5a6385";
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  ctx.fillText(`${title} · ${voters} ${voters === 1 ? "player" : "players"} · ${date}`, PAD, PAD + 44);

  let y = PAD + HEADER;
  sections.forEach((section, i) => {
    if (section.heading) {
      ctx.fillStyle = "#2d3354";
      ctx.font = `800 15px ${font}`;
      ctx.fillText(section.heading, PAD, y + 20);
      y += SECTION_HEAD;
    }
    for (const { tier, lines } of rows[i]) {
      const h = rowHeight(lines.length);
      ctx.fillStyle = "#fffaf0";
      roundRect(ctx, PAD, y, WIDTH - PAD * 2, h, 10);
      ctx.fill();
      // Tier badge.
      const color = TIER_COLOR[tier.id];
      ctx.fillStyle = color.bg;
      roundRect(ctx, PAD + 4, y + 4, LABEL_W - 4, h - 8, 8);
      ctx.fill();
      ctx.fillStyle = color.fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${tier.label.length > 2 ? 11 : 18}px ${font}`;
      ctx.fillText(tier.label, PAD + 2 + LABEL_W / 2, y + h / 2, LABEL_W - 8);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      // Sprites, best first, left to right.
      lines.forEach((ranked, j) => {
        const x = PAD + LABEL_W + 8 + (j % COLS) * (ICON + GAP);
        const top = y + ROW_PAD + Math.floor(j / COLS) * (ICON + GAP);
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, x, top, ICON, ICON, 10);
        ctx.fill();
        const img = sprites.get(lineSpriteUrl(ranked.line));
        if (img) ctx.drawImage(img, x + 2, top + 2, ICON - 4, ICON - 4);
        const ring = ringWidth(ranked.tops, maxTops);
        if (ring > 0) {
          ctx.strokeStyle = STAR_GOLD;
          ctx.lineWidth = ring;
          roundRect(ctx, x + ring / 2, top + ring / 2, ICON - ring, ICON - ring, 10 - ring / 2);
          ctx.stroke();
        }
        if (ranked.tops >= 2) drawStarCount(ctx, font, ranked.tops, x + ICON, top);
      });
      y += h + 4;
    }
    y += 6;
  });

  ctx.fillStyle = "#8a97ab";
  ctx.font = `400 11px ${font}`;
  if (maxTops > 0) {
    // Legend for the rings, bottom left.
    ctx.strokeStyle = STAR_GOLD;
    ctx.lineWidth = 2;
    roundRect(ctx, PAD, height - 21, 14, 14, 4);
    ctx.stroke();
    ctx.fillText("Top 3 picks (thicker ring, ★ = more players)", PAD + 20, height - 10);
  }
  ctx.textAlign = "right";
  ctx.fillText(`Made with Pleep Matchmaker · ${window.location.host}`, WIDTH - PAD, height - 10);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't draw the image"))), "image/png"),
  );
}

/** "★5" pill on a sprite's top-right corner. */
function drawStarCount(ctx: CanvasRenderingContext2D, font: string, tops: number, right: number, top: number) {
  const text = `★${tops > 99 ? "99+" : tops}`;
  ctx.font = `800 9px ${font}`;
  const w = ctx.measureText(text).width + 6;
  const x = right - w + 2;
  const y = top - 3;
  ctx.fillStyle = STAR_GOLD;
  roundRect(ctx, x, y, w, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + 6.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

const fileName = (title: string) =>
  `tier-list-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;

/**
 * Export button: draws a compact image of the tier list currently shown and
 * opens it in a popup with Copy, Download and (on phones) Share.
 */
export function TierExport({
  title,
  voters,
  sections,
  label = "Export image",
}: {
  title: string;
  voters: number;
  sections: ExportSection[];
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url);
  }, [image]);

  async function open() {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await renderPng(title, voters, sections);
      setImage({ blob, url: URL.createObjectURL(blob) });
      dialog.current?.showModal();
    } catch {
      setStatus("Couldn't make the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!image) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image.blob })]);
      setStatus("Copied. Paste it anywhere.");
    } catch {
      setStatus("Your browser can't copy images. Use Download instead.");
    }
  }

  const file = image ? new File([image.blob], fileName(title), { type: "image/png" }) : null;
  const canShare = typeof navigator !== "undefined" && !!file && !!navigator.canShare?.({ files: [file] });

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold hover:bg-white/60 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-night"
      >
        {busy ? "Drawing…" : `⤓ ${label}`}
      </button>
      {status && !image && <span className="ml-2 text-xs text-dont">{status}</span>}
      <dialog
        ref={dialog}
        onClose={() => setStatus(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        aria-label="Export tier list"
        className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/60 dark:bg-night dark:text-[#eef1ff]"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-extrabold">Export: {title}</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-full px-2 text-2xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              ×
            </button>
          </div>
          {image && <img src={image.url} alt={`Tier list: ${title}`} className="w-full rounded-xl" />}
          <div className="flex flex-wrap gap-2">
            {image && typeof ClipboardItem !== "undefined" && (
              <button type="button" onClick={copy} className="btn-primary px-4 py-2">
                Copy image
              </button>
            )}
            {image && (
              <a href={image.url} download={fileName(title)} className="btn-primary px-4 py-2">
                Download
              </a>
            )}
            {canShare && (
              <button
                type="button"
                onClick={() => navigator.share({ files: [file!] }).catch(() => {})}
                className="btn-primary px-4 py-2"
              >
                Share
              </button>
            )}
          </div>
          {status && <p className="text-sm text-slate-600 dark:text-slate-300">{status}</p>}
          <p className="text-xs text-slate-500">On a phone you can also press and hold the image to save it.</p>
        </div>
      </dialog>
    </>
  );
}
