/**
 * In-game name matching for Not here yet. Keep SYMBOLS and strongNameKey in
 * step with public.strong_name_key (20261018000200_strong_name_match.sql),
 * which drives the "may have joined" hint and the auto-removal on add.
 */

/** Separators and decorations a player may leave out or type differently. */
export const SYMBOLS = "_.-'\"`~・·•☆★♪♫♬♡♥❤!?*^=+|/\\()[]{}<>,:;#@&%$。、";
const DROP = new Set(Array.from(SYMBOLS));

/**
 * Same name for matching purposes: NFKC (full-width letters become normal
 * ones), lowercase, no whitespace or SYMBOLS. A name that is only symbols
 * keeps them, so "★★" still only matches "★★".
 */
export function strongNameKey(name: string | null | undefined): string {
  const base = (name ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  const key = Array.from(base.replace(/\s/g, "")).filter((c) => !DROP.has(c)).join("");
  return key || base;
}

function withinOneEdit(a: string[], b: string[]): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * "strong": the same name (strongNameKey). "close": one contains the other
 * (3+ characters) or one typo apart (5+). Strong is safe to act on; close is
 * only a hint for the player to check (e.g. on someone who added you).
 */
export function nameMatch(a: string | null | undefined, b: string | null | undefined): "strong" | "close" | null {
  if (!a || !b) return null;
  const ka = strongNameKey(a);
  const kb = strongNameKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return "strong";
  const ca = Array.from(ka);
  const cb = Array.from(kb);
  const shorter = Math.min(ca.length, cb.length);
  if (shorter >= 3 && (ka.includes(kb) || kb.includes(ka))) return "close";
  if (shorter >= 5 && withinOneEdit(ca, cb)) return "close";
  return null;
}
