/**
 * In-game name matching for Not here yet. Keep SYMBOLS, FOLDS and
 * strongNameKey in step with public.strong_name_key
 * (20261018000200_strong_name_match.sql), which drives the "may have joined"
 * hint, the auto-removal on add and lookalike-symbol search; names.test.ts
 * checks the migration carries the same lists.
 */

/** Lookalike symbols typed differently on different keyboards, folded to one. */
const FOLDS: [string, string][] = [
  ["★☆✩✪✫✬✭✮✯✰⭐🌟", "★"],
  ["♥♡❤❥❣💕💗💖💓💞💘💝🧡💛💚💙💜🤍🖤🤎", "♥"],
  ["♪♫♬♩🎵🎶", "♪"],
  ["●○◦◯⚪⚫", "○"],
  ["・·•", "・"],
  ["~〜", "~"],
];
export const FOLD_FROM = FOLDS.map(([from]) => from).join("");
export const FOLD_TO = FOLDS.map(([from, to]) => to.repeat(Array.from(from).length)).join("");
const FOLD = new Map(FOLDS.flatMap(([from, to]) => Array.from(from).map((c): [string, string] => [c, to])));

/** Separators and decorations a player may leave out or type differently. */
export const SYMBOLS = "_.-'\"`!?*^=+|/\\()[]{}<>,:;#@&%$。、" + FOLD_FROM;
const DROP = new Set(Array.from(SYMBOLS));

/**
 * Same name for matching purposes: NFKC (full-width letters become normal
 * ones), lowercase, no whitespace, emoji variation selectors or SYMBOLS. A
 * name that is only symbols keeps them, with lookalikes folded, so "☆" and
 * "★" match each other but not "♪".
 */
export function strongNameKey(name: string | null | undefined): string {
  const chars = Array.from(
    (name ?? "").normalize("NFKC").toLowerCase().replace(/[\s\uFE0E\uFE0F]/g, ""),
  );
  const key = chars.filter((c) => !DROP.has(c)).join("");
  return key || chars.map((c) => FOLD.get(c) ?? c).join("");
}

const hasLetters = (key: string) => /[\p{L}\p{N}]/u.test(key);

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
 * (3+ characters), one typo apart (5+), or both only symbols. Strong is safe
 * to act on; close is only a hint for the player to check (e.g. on someone
 * who sent you a friend request).
 */
export function nameMatch(a: string | null | undefined, b: string | null | undefined): "strong" | "close" | null {
  if (!a || !b) return null;
  const ka = strongNameKey(a);
  const kb = strongNameKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return "strong";
  // Two names made only of symbols can't be compared by spelling: worth a look, never more.
  if (!hasLetters(ka) && !hasLetters(kb)) return "close";
  const ca = Array.from(ka);
  const cb = Array.from(kb);
  const shorter = Math.min(ca.length, cb.length);
  if (shorter >= 3 && (ka.includes(kb) || kb.includes(ka))) return "close";
  if (shorter >= 5 && withinOneEdit(ca, cb)) return "close";
  return null;
}
