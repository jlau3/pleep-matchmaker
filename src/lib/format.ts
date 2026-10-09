/** Accepts any spacing or dashes; returns the 12 digits, or null if invalid. */
export function normalizeFriendCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 12 ? digits : null;
}

/** "123456789012" -> "1234 5678 9012" */
export function formatFriendCode(code: string): string {
  return code.replace(/(\d{4})(?=\d)/g, "$1 ");
}

const UNITS: [number, string][] = [
  [365 * 24 * 3600, "y"],
  [30 * 24 * 3600, "mo"],
  [7 * 24 * 3600, "w"],
  [24 * 3600, "d"],
  [3600, "h"],
  [60, "m"],
];

export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  for (const [size, unit] of UNITS) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
  }
  return "just now";
}
